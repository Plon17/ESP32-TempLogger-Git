const REFRESH_INTERVAL = 6000;
const SHEET_ID = '16SUgOaXTlA_Nf_YO9q0ZpEAiRRpheRUWdpfSEy7YYCc';
const SHEET_NAME = 'Temp Sensor Data';

let lastTimestamp = null;
let refreshIntervalId = null;

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
    
    processData(rows[rows.length - 1]);
  } catch (error) {
    handleError(error);
  }
}

function processData(row) {
  const cols = parseCSVRow(row);
  console.log('Parsed cols:', cols);
  
  if (cols.length >= 5) {
    try {
      const dateStr = cols[0].replace(/^"|"$/g, '').trim();
      const timeStr = cols[1].replace(/^"|"$/g, '').trim();
      const fullTimestamp = `${dateStr} ${timeStr}`;
      const temp = parseFloat(cols[2].replace(/^"|"$/g, '').trim());
      const hum = parseFloat(cols[3].replace(/^"|"$/g, '').trim());
      
      if (!isNaN(temp) && !isNaN(hum) && dateStr && timeStr) {
        const newDataFound = !lastTimestamp || new Date(fullTimestamp) > new Date(lastTimestamp);
        lastTimestamp = fullTimestamp;
        updateDisplay(fullTimestamp, temp, hum, newDataFound);
      } else {
        console.error('Invalid data:', { dateStr, timeStr, temp, hum, row });
        handleError(new Error('Invalid data in latest row'));
      }
    } catch (e) {
      console.error('Error parsing row:', row, e);
      handleError(e);
    }
  } else {
    console.error('Invalid column count:', cols, 'in row:', row);
    handleError(new Error('Invalid column count in latest row'));
  }
}

function updateDisplay(timestamp, temp, hum, newDataFound) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'none';
  
  document.getElementById('temperature').textContent = `${temp.toFixed(1)} °C`;
  document.getElementById('humidity').textContent = `${hum.toFixed(1)} %`;
  document.getElementById('lastReading').textContent = timestamp;
  
  const now = new Date();
  document.getElementById('status').textContent = `Last updated: ${now.toLocaleTimeString()}`;
  const indicator = document.getElementById('dataIndicator');
  const dataStatus = document.getElementById('dataStatus');
  indicator.className = newDataFound ? 'indicator on' : 'indicator off';
  dataStatus.textContent = newDataFound ? 'Data: On' : 'Data: Off';
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

document.getElementById('refreshBtn').addEventListener('click', () => {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('error').style.display = 'none';
  fetchData();
});

window.addEventListener('beforeunload', () => {
  if (refreshIntervalId) clearInterval(refreshIntervalId);
});

document.getElementById('loading').style.display = 'block';
fetchData();
refreshIntervalId = setInterval(fetchData, REFRESH_INTERVAL);