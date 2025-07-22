const SHEET_ID = '16SUgOaXTlA_Nf_YO9q0ZpEAiRRpheRUWdpfSEy7YYCc';
const SHEET_NAME = 'Temp Sensor Data';

let allData = [];
let chart = null;

async function fetchData() {
  try {
    document.getElementById('loading').textContent = 'Loading historical data...';
    document.getElementById('loading').style.display = 'block';
    document.getElementById('error').style.display = 'none';
    
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    const response = await fetch(`${url}&t=${new Date().getTime()}`, {
      cache: 'no-store',
      headers: { 'Accept': 'text/csv' }
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const dataText = await response.text();
    const rows = dataText.split('\n').filter(row => row.trim() !== '');
    
    if (rows.length <= 1) throw new Error('No data rows found in the sheet');
    
    const headers = parseCSVRow(rows[0]).map(h => h.toLowerCase().trim());
    processData(rows.slice(1), headers);
  } catch (error) {
    handleError(error);
  }
}

function parseCSVRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result.map(item => item.trim().replace(/^"|"$/g, ''));
}

function processData(dataRows, headers) {
  allData = [];
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const timeIdx = headers.findIndex(h => h.includes('time'));
  const tempIdx = headers.findIndex(h => h.includes('temp'));
  const humIdx = headers.findIndex(h => h.includes('hum'));
  const locIdx = headers.findIndex(h => h.includes('loc'));

  for (const row of dataRows) {
    try {
      const cols = parseCSVRow(row);
      
      if (cols.length < 5) continue;

      const dateStr = cols[dateIdx].trim();
      const timeStr = cols[timeIdx].trim();
      const temp = parseFloat(cols[tempIdx].replace(',', '.'));
      const hum = parseFloat(cols[humIdx].replace(',', '.'));
      const loc = cols[locIdx].trim();

      if (!dateStr || isNaN(temp) || isNaN(hum)) continue;

      allData.push({
        date: dateStr,
        time: timeStr,
        temp,
        hum,
        loc
      });
    } catch (e) {
      console.error('Error processing row:', e);
    }
  }
  
  if (allData.length > 0) {
    generatePredictions();
  } else {
    handleError(new Error('No valid data processed. Check if your spreadsheet matches the expected format.'));
  }
}

function handleError(error) {
  console.error('Error:', error);
  const errorEl = document.getElementById('error');
  errorEl.textContent = `Error: ${error.message}`;
  errorEl.style.display = 'block';
  document.getElementById('loading').style.display = 'none';
}

function calculateDailyAverages(data) {
  const dailyData = {};
  
  data.forEach(row => {
    if (!dailyData[row.date]) {
      dailyData[row.date] = { temp: [], hum: [] };
    }
    dailyData[row.date].temp.push(row.temp);
    dailyData[row.date].hum.push(row.hum);
  });
  
  const averages = {};
  Object.keys(dailyData).forEach(date => {
    const temps = dailyData[date].temp;
    const hums = dailyData[date].hum;
    
    averages[date] = {
      temp: temps.reduce((a, b) => a + b, 0) / temps.length,
      hum: hums.reduce((a, b) => a + b, 0) / hums.length
    };
  });
  
  return averages;
}

function predictValues() {
  if (allData.length === 0) return [];
  
  const sortedData = [...allData].sort((a, b) => 
    new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time)
  );
  
  const dailyAverages = calculateDailyAverages(sortedData);
  const dates = Object.keys(dailyAverages).sort();
  
  if (dates.length < 2) {
    const avg = dailyAverages[dates[0]];
    const predictions = [];
    const lastDate = new Date(dates[0]);
    
    for (let i = 1; i <= 7; i++) {
      const predDate = new Date(lastDate);
      predDate.setDate(lastDate.getDate() + i);
      
      predictions.push({
        date: predDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
        temp: avg.temp,
        hum: avg.hum
      });
    }
    return predictions;
  }
  
  const firstAvg = dailyAverages[dates[0]];
  const lastAvg = dailyAverages[dates[dates.length - 1]];
  const daysBetween = (new Date(dates[dates.length - 1]) - new Date(dates[0])) / (1000 * 60 * 60 * 24);
  
  const tempTrend = (lastAvg.temp - firstAvg.temp) / daysBetween;
  const humTrend = (lastAvg.hum - firstAvg.hum) / daysBetween;
  
  const predictions = [];
  const lastDate = new Date(dates[dates.length - 1]);
  
  for (let i = 1; i <= 7; i++) {
    const predDate = new Date(lastDate);
    predDate.setDate(lastDate.getDate() + i);
    
    predictions.push({
      date: predDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      temp: Math.max(0, lastAvg.temp + tempTrend * i),
      hum: Math.min(100, Math.max(0, lastAvg.hum + humTrend * i))
    });
  }
  
  return predictions;
}

function updateCards(predictions) {
  const container = document.getElementById('predictionCards');
  container.innerHTML = '';
  
  if (predictions.length === 0) {
    container.innerHTML = '<p>No predictions available</p>';
    return;
  }
  
  predictions.forEach(pred => {
    const card = document.createElement('div');
    card.className = 'prediction-card';
    card.innerHTML = `
      <h3>${pred.date}</h3>
      <p>☀️ Temp: ${pred.temp.toFixed(1)}°C</p>
      <p>💧 Hum: ${pred.hum.toFixed(1)}%</p>
    `;
    container.appendChild(card);
  });
}

function drawChart(predictions) {
  const ctx = document.getElementById('chartCanvas').getContext('2d');
  
  if (chart) chart.destroy();
  
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: predictions.map(p => p.date.split(',')[0]),
      datasets: [
        {
          label: 'Temperature (°C)',
          data: predictions.map(p => p.temp),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          yAxisID: 'y',
        },
        {
          label: 'Humidity (%)',
          data: predictions.map(p => p.hum),
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Temperature (°C)'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          max: 100,
          title: {
            display: true,
            text: 'Humidity (%)'
          },
          grid: {
            drawOnChartArea: false,
          },
        }
      }
    }
  });
}

function generatePredictions() {
  const predictions = predictValues();
  updateCards(predictions);
  drawChart(predictions);
  document.getElementById('loading').style.display = 'none';
}

// Initialize
document.addEventListener('DOMContentLoaded', fetchData);