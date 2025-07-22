const SHEET_ID = '16SUgOaXTlA_Nf_YO9q0ZpEAiRRpheRUWdpfSEy7YYCc';
const SHEET_NAME = 'Temp Sensor Data';

let allData = [];

async function fetchData() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    const response = await fetch(`${url}&t=${new Date().getTime()}`, {
      cache: 'no-store',
      headers: { 'Accept': 'text/csv' }
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const dataText = await response.text();
    console.log('Raw CSV:', dataText);
    const rows = dataText.split('\n').filter(row => row.trim() !== '');
    console.log('Parsed Rows:', rows);
    
    if (rows.length <= 1) throw new Error('No data rows found in the sheet');
    
    processData(rows.slice(1));
  } catch (error) {
    handleError(error);
    console.error('Fetch Error:', error);
  }
}

function processData(dataRows) {
  allData = [];
  for (const row of dataRows) {
    const cols = parseCSVRow(row);
    console.log('Parsed cols:', cols);
    
    if (cols.length >= 5) {
      try {
        const date = cols[0].replace(/^"|"$/g, '').trim();
        const time = cols[1].replace(/^"|"$/g, '').trim();
        const temp = parseFloat(cols[2].replace(/^"|"$/g, '').trim());
        const hum = parseFloat(cols[3].replace(/^"|"$/g, '').trim());
        const loc = cols[4].replace(/^"|"$/g, '').trim();
        
        if (!isNaN(temp) && !isNaN(hum) && date && time && loc) {
          allData.push({ date, time, temp, hum, loc });
        } else {
          console.error('Invalid data:', { date, time, temp, hum, loc, row });
        }
      } catch (e) {
        console.error('Error parsing row:', row, e);
      }
    } else {
      console.error('Invalid column count:', cols, 'in row:', row);
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
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.filter(item => item !== '');
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
    if (!dailyData[row.date]) dailyData[row.date] = { temp: [], hum: [] };
    dailyData[row.date].temp.push(row.temp);
    dailyData[row.date].hum.push(row.hum);
  });
  
  const averages = {};
  for (let date in dailyData) {
    averages[date] = {
      temp: dailyData[date].temp.reduce((a, b) => a + b, 0) / dailyData[date].temp.length,
      hum: dailyData[date].hum.reduce((a, b) => a + b, 0) / dailyData[date].hum.length
    };
  }
  return averages;
}

function predictValues() {
  if (allData.length === 0) {
    alert('No data available for prediction');
    return [];
  }
  
  allData.sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));
  const latestDate = new Date(allData[0].date + ' ' + allData[0].time);
  const dailyAverages = calculateDailyAverages(allData);
  const dates = Object.keys(dailyAverages).sort();
  
  if (dates.length < 2) {
    alert('Need at least 2 days of data for prediction');
    return [];
  }
  
  const tempTrend = (dailyAverages[dates[dates.length - 1]].temp - dailyAverages[dates[0]].temp) / (dates.length - 1);
  const humTrend = (dailyAverages[dates[dates.length - 1]].hum - dailyAverages[dates[0]].hum) / (dates.length - 1);
  const lastTemp = dailyAverages[dates[dates.length - 1]].temp;
  const lastHum = dailyAverages[dates[dates.length - 1]].hum;
  
  const predictions = [];
  for (let i = 1; i <= 7; i++) {
    const predDate = new Date(latestDate);
    predDate.setDate(latestDate.getDate() + i);
    const predTemp = lastTemp + tempTrend * i;
    const predHum = lastHum + humTrend * i;
    predictions.push({
      date: predDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' }),
      temp: Math.max(0, predTemp),
      hum: Math.min(100, Math.max(0, predHum))
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
  const canvas = document.getElementById('chartCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const dates = predictions.map(p => p.date);
  const temps = predictions.map(p => p.temp);
  const hums = predictions.map(p => p.hum);
  
  const maxValue = Math.max(...temps, ...hums);
  const step = canvas.height / (maxValue + 10);
  const width = canvas.width / (dates.length + 1);
  
  ctx.beginPath();
  ctx.strokeStyle = 'blue';
  ctx.lineWidth = 2;
  temps.forEach((temp, i) => {
    const x = (i + 1) * width;
    const y = canvas.height - (temp * step);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  
  ctx.beginPath();
  ctx.strokeStyle = 'red';
  hums.forEach((hum, i) => {
    const x = (i + 1) * width;
    const y = canvas.height - (hum * step);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  
  ctx.fillStyle = 'black';
  ctx.font = '12px Arial';
  dates.forEach((date, i) => {
    const x = (i + 1) * width;
    ctx.fillText(date.split(',')[1].trim(), x - 20, canvas.height - 5); // Show only date part under chart
  });
}

function generatePredictions() {
  const predictions = predictValues();
  updateCards(predictions);
  drawChart(predictions);
  document.getElementById('loading').style.display = 'none';
}

document.getElementById('loading').style.display = 'block';
fetchData();