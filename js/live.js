const REFRESH_INTERVAL = 5000;
let lastTimestamp = null;
let refreshIntervalId = null;

async function fetchLatestData() {
  try {
    document.getElementById('loading').style.display = 'block';
    const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6P6hzIdOoBMMRfgCgFF7gQ9DWvhlsmXz2hxHx3mmJuYIlanN8QjWWYT1V34UXd9PJC-2qWbTiBriZ/pub?gid=0&single=true&output=csv';
    const timestamp = new Date().getTime();
    const response = await fetch(`${url}&t=${timestamp}`);
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const dataText = await response.text();
    const rows = dataText.split('\n').filter(row => row.trim() !== '');
    
    if (rows.length <= 1) throw new Error('No data rows found in the sheet');
    
    const lastRow = rows[rows.length - 1];
    const cols = parseCSVRow(lastRow);
    
    if (cols.length >= 4) {
      const dateStr = cols[0].trim();
      const timeStr = cols[1].trim();
      const fullTimestamp = `${dateStr} ${timeStr}`;
      const temp = parseFloat(cols[2].trim());
      const hum = parseFloat(cols[3].trim());
      
      if (!isNaN(temp) && !isNaN(hum)) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'none';
        
        document.getElementById('tempValue').textContent = temp.toFixed(1) + '°C';
        document.getElementById('humValue').textContent = hum.toFixed(1) + '%';
        
        const now = new Date();
        document.getElementById('status').textContent = `Last updated: ${now.toLocaleTimeString()}`;
        
        const indicator = document.getElementById('dataIndicator');
        const dataStatus = document.getElementById('dataStatus');
        const newDataFound = !lastTimestamp || new Date(fullTimestamp) > new Date(lastTimestamp);
        lastTimestamp = fullTimestamp;
        
        if (newDataFound) {
          indicator.className = 'indicator on';
          dataStatus.textContent = 'Incoming Data: On';
        } else {
          indicator.className = 'indicator off';
          dataStatus.textContent = 'Incoming Data: Off';
        }
      } else {
        showError('Invalid data format in the latest reading.');
      }
    } else {
      showError('Incomplete data in the latest reading.');
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    showError(`Error loading data: ${error.message}`);
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
  return result;
}

function showError(message) {
  const errorEl = document.getElementById('error');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  document.getElementById('loading').style.display = 'none';
}

fetchLatestData();
refreshIntervalId = setInterval(fetchLatestData, REFRESH_INTERVAL);

window.addEventListener('beforeunload', () => {
  if (refreshIntervalId) clearInterval(refreshIntervalId);
});