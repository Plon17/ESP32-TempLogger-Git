const MAX_DATA_POINTS = 10;
const REFRESH_INTERVAL = 5000;

const chartCtx = document.getElementById('chart').getContext('2d');
const sensorChart = new Chart(chartCtx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      { 
        label: 'Temperature (°C)', 
        data: [], 
        borderColor: '#e74c3c',
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        borderWidth: 2,
        tension: 0.2,
        fill: true,
        yAxisID: 'y' 
      },
      { 
        label: 'Humidity (%)', 
        data: [], 
        borderColor: '#3498db',
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        borderWidth: 2,
        tension: 0.2,
        fill: true,
        yAxisID: 'y1'
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
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12,
          padding: 20,
          font: { weight: 'bold' }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 12,
        usePointStyle: true,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(1);
              label += context.dataset.label.includes('Temperature') ? '°C' : '%';
            }
            return label;
          }
        }
      }
    },
    animation: { duration: 800 },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#7f8c8d',
          maxRotation: 0,
          callback: function(value) {
            const fullDate = this.getLabelForValue(value);
            const [, time] = fullDate.split(' ');
            return time;
          }
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Temperature (°C)',
          color: '#e74c3c',
          font: { weight: 'bold' }
        },
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        suggestedMin: 0,
        suggestedMax: 40
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Humidity (%)',
          color: '#3498db',
          font: { weight: 'bold' }
        },
        grid: { drawOnChartArea: false },
        min: 0,
        max: 100,
        ticks: {
          callback: function(value) { return value + '%'; }
        }
      }
    }
  }
});

let lastTimestamp = null;
let refreshIntervalId = null;

async function fetchData() {
  try {
    document.getElementById('loading').style.display = 'block';
    const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6P6hzIdOoBMMRfgCgFF7gQ9DWvhlsmXz2hxHx3mmJuYIlanN8QjWWYT1V34UXd9PJC-2qWbTiBriZ/pub?gid=0&single=true&output=csv';
    const timestamp = new Date().getTime();
    const response = await fetch(`${url}&t=${timestamp}`);
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const dataText = await response.text();
    const rows = dataText.split('\n').filter(row => row.trim() !== '');
    
    if (rows.length <= 1) throw new Error('No data rows found in the sheet');
    
    const dataRows = rows.slice(1);
    const newTimes = [];
    const newTemps = [];
    const newHums = [];
    let newDataFound = false;

    const startIdx = Math.max(0, dataRows.length - MAX_DATA_POINTS);
    for (let i = dataRows.length - 1; i >= startIdx; i--) {
      const row = dataRows[i];
      const cols = parseCSVRow(row);
      
      if (cols.length >= 4) {
        try {
          const dateStr = cols[0].trim();
          const timeStr = cols[1].trim();
          const fullTimestamp = `${dateStr} ${timeStr}`;
          const temp = parseFloat(cols[2].trim());
          const hum = parseFloat(cols[3].trim());
          
          if (!isNaN(temp) && !isNaN(hum)) {
            if (!lastTimestamp || new Date(fullTimestamp) > new Date(lastTimestamp)) {
              newDataFound = true;
              lastTimestamp = fullTimestamp;
            }
            newTimes.push(fullTimestamp);
            newTemps.push(temp);
            newHums.push(hum);
          }
        } catch (e) {
          console.error('Error parsing row:', row, e);
        }
      }
    }

    newTimes.reverse();
    newTemps.reverse();
    newHums.reverse();

    if (newTimes.length > 0) {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('error').style.display = 'none';
      
      sensorChart.data.labels = newTimes;
      sensorChart.data.datasets[0].data = newTemps;
      sensorChart.data.datasets[1].data = newHums;
      sensorChart.update();
      
      const now = new Date();
      document.getElementById('status').textContent = `Last updated: ${now.toLocaleTimeString()}`;
      
      const indicator = document.getElementById('dataIndicator');
      const dataStatus = document.getElementById('dataStatus');
      if (newDataFound) {
        indicator.className = 'indicator on';
        dataStatus.textContent = 'Incoming Data: On';
      } else {
        indicator.className = 'indicator off';
        dataStatus.textContent = 'Incoming Data: Off';
      }
    } else {
      showError('No valid data found in the sheet.');
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    showError(`Error loading data: ${error.message}`);
  }
}

function showError(message) {
  const errorEl = document.getElementById('error');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  document.getElementById('loading').style.display = 'none';
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

document.getElementById('refreshBtn').addEventListener('click', fetchData);
fetchData();
refreshIntervalId = setInterval(fetchData, REFRESH_INTERVAL);

window.addEventListener('beforeunload', () => {
  if (refreshIntervalId) clearInterval(refreshIntervalId);
});