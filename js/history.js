async function fetchAllData() {
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
    const data = [];
    
    for (const row of dataRows) {
      const cols = parseCSVRow(row);
      if (cols.length >= 4) {
        try {
          const dateStr = cols[0].trim();
          const timeStr = cols[1].trim();
          const temp = parseFloat(cols[2].trim());
          const hum = parseFloat(cols[3].trim());
          
          if (!isNaN(temp) && !isNaN(hum)) {
            data.push({ date: dateStr, time: timeStr, temp, hum });
          }
        } catch (e) {
          console.error('Error parsing row:', row, e);
        }
      }
    }
    
    return data.reverse();
  } catch (error) {
    console.error('Error fetching data:', error);
    showError(`Error loading data: ${error.message}`);
    return [];
  } finally {
    document.getElementById('loading').style.display = 'none';
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
}

function renderTable(data) {
  const tbody = document.getElementById('dataTableBody');
  tbody.innerHTML = '';
  
  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${row.time}</td>
      <td>${row.temp.toFixed(1)}°C</td>
      <td>${row.hum.toFixed(1)}%</td>
    `;
    tbody.appendChild(tr);
  });
}

async function init() {
  const data = await fetchAllData();
  renderTable(data);
  
  document.getElementById('applyFilter').addEventListener('click', async () => {
    const dateFilter = document.getElementById('dateFilter').value;
    if (!dateFilter) return;
    
    const data = await fetchAllData();
    const filteredData = data.filter(row => row.date === dateFilter);
    renderTable(filteredData);
  });
  
  document.getElementById('clearFilter').addEventListener('click', async () => {
    document.getElementById('dateFilter').value = '';
    const data = await fetchAllData();
    renderTable(data);
  });
}

init();