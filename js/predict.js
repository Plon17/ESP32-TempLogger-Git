const SHEET_ID = '16SUgOaXTlA_Nf_YO9q0ZpEAiRRpheRUWdpfSEy7YYCc';
const SHEET_NAME = 'Temp Sensor Data';

let allData = [];
let chart = null;

async function fetchData() {
  try {
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
    
    // Parse CSV with proper header handling
    const headers = parseCSVRow(rows[0]).map(h => h.toLowerCase());
    processData(rows.slice(1), headers);
  } catch (error) {
    handleError(error);
  }
}

function processData(dataRows, headers) {
  allData = [];
  const dateIdx = headers.findIndex(h => h.includes('date'));
  const timeIdx = headers.findIndex(h => h.includes('time'));
  const tempIdx = headers.findIndex(h => h.includes('temp'));
  const humIdx = headers.findIndex(h => h.includes('hum'));
  const locIdx = headers.findIndex(h => h.includes('loc'));

  for (const row of dataRows) {
    const cols = parseCSVRow(row);
    
    if (cols.length >= 5) {
      try {
        // Parse date in DD/MM/YYYY format
        const dateParts = cols[dateIdx].split('/');
        const isoDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
        
        const temp = parseFloat(cols[tempIdx]);
        const hum = parseFloat(cols[humIdx]);
        
        if (!isNaN(temp) && !isNaN(hum)) {
          allData.push({
            date: isoDate,
            time: cols[timeIdx],
            temp,
            hum,
            loc: cols[locIdx]
          });
        }
      } catch (e) {
        console.error('Error parsing row:', e);
      }
    }
  }
  
  if (allData.length > 0) {
    generatePredictions();
  } else {
    handleError(new Error('No valid data processed'));
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
        // Escaped quote
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

function handleError(error) {
  console.error('Error:', error);
  const errorEl = document.getElementById('error');
  errorEl.textContent = `Error loading data: ${error.message}`;
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
  
  // Sort by date (YYYY-MM-DD format works natively)
  const sortedData = [...allData].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );
  
  const dailyAverages = calculateDailyAverages(sortedData);
  const dates = Object.keys(dailyAverages).sort();
  
  if (dates.length < 2) return [];
  
  // Get first and last dates
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  
  // Calculate days between first and last date
  const daysBetween = (new Date(lastDate) - new Date(firstDate)) / (1000 * 60 * 60 * 24);
  
  // Calculate trends
  const tempTrend = (dailyAverages[lastDate].temp - dailyAverages[firstDate].temp) / daysBetween;
  const humTrend = (dailyAverages[lastDate].hum - dailyAverages[firstDate].hum) / daysBetween;
  
  const lastTemp = dailyAverages[lastDate].temp;
  const lastHum = dailyAverages[lastDate].hum;
  
  // Generate predictions
  const predictions = [];
  for (let i = 1; i <= 7; i++) {
    const predDate = new Date(lastDate);
    predDate.setDate(predDate.getDate() + i);
    
    predictions.push({
      date: predDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      temp: Math.max(0, lastTemp + tempTrend * i),
      hum: Math.min(100, Math.max(0, lastHum + humTrend * i))
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
  
  // Destroy existing chart if it exists
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
document.addEventListener('DOMContentLoaded', () => {
  fetchData();
});