const REFRESH_INTERVAL = 6000;
const MAX_DATA_POINTS = 10;
const SHEET_ID = '16SUgOaXTlA_Nf_YO9q0ZpEAiRRpheRUWdpfSEy7YYCc';
const SHEET_NAME = 'Temp Sensor Data';

let lastTimestamp = null;
let refreshIntervalId = null;

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
  options: getChartOptions()
});

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
  }
}

function processData(dataRows) {
  const newTimes = [];
  const newTemps = [];
  const newHums = [];
  let newDataFound = false;

  console.log('Processing rows:', dataRows);

  const startIdx = Math.max(0, dataRows.length - MAX_DATA_POINTS);
  
  for (let i = dataRows.length - 1; i >= startIdx; i--) {
    const cols = parseCSVRow(dataRows[i]);
    console.log('Parsed cols:', cols);
    
    if (cols.length >= 5) {
      try {
        const dateStr = cols[0].replace(/^"|"$/g, '').trim();
        const timeStr = cols[1].replace(/^"|"$/g, '').trim();
        const fullTimestamp = `${dateStr} ${timeStr}`;
        const temp = parseFloat(cols[2].replace(/^"|"$/g, '').trim());
        const hum = parseFloat(cols[3].replace(/^"|"$/g, '').trim());
        
        if (!isNaN(temp) && !isNaN(hum) && dateStr && timeStr) {
          newTimes.push(fullTimestamp);
          newTemps.push(temp);
          newHums.push(hum);
          
          if (!lastTimestamp || new Date(fullTimestamp) > new Date(lastTimestamp)) {
            newDataFound = true;
            lastTimestamp = fullTimestamp;
          }
        } else {
          console.error('Invalid data:', { dateStr, timeStr, temp, hum, row: dataRows[i] });
        }
      } catch (e) {
        console.error('Error parsing row:', dataRows[i], e);
      }
    } else {
      console.error('Invalid column count:', cols, 'in row:', dataRows[i]);
    }
  }

  console.log('Processed data:', { newTimes, newTemps, newHums, newDataFound });
  if (newTimes.length > 0) {
    updateChart(newTimes.reverse(), newTemps.reverse(), newHums.reverse(), newDataFound);
  } else {
    handleError(new Error('No valid data rows found'));
  }
}

function updateChart(times, temps, hums, newDataFound) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'none';
  
  sensorChart.data.labels = times;
  sensorChart.data.datasets[0].data = temps;
  sensorChart.data.datasets[1].data = hums;
  sensorChart.update();
  
  const now = new Date();
  document.getElementById('status').textContent = `Last updated: ${now.toLocaleTimeString()}`;
  document.getElementById('lastFetched').textContent = `Last fetched: ${times[times.length - 1] || 'Never'}`;
  
  const indicator = document.getElementById('dataIndicator');
  const dataStatus = document.getElementById('dataStatus');
  indicator.className = newDataFound ? 'indicator on' : 'indicator off';
  dataStatus.textContent = newDataFound ? 'Data: On' : 'Data: Off';
}

function getChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { boxWidth: 12, padding: 20, font: { weight: 'bold' } }
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
            return this.getLabelForValue(value).split(' ')[1];
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
        min: function(context) {
          const values = context.chart.data.datasets[0].data;
          return values.length ? Math.floor(Math.min(...values)) - 2 : 0;
        },
        max: function(context) {
          const values = context.chart.data.datasets[0].data;
          return values.length ? Math.ceil(Math.max(...values)) + 2 : 40;
        }
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
        ticks: { callback: function(value) { return value + '%'; } }
      }
    }
  };
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