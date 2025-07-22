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
    updateTable(allData);
  } else {
    handleError(new Error('No valid data rows found'));
  }
}

function updateTable(data) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'none';
  
  const tableBody = document.getElementById('tableBody');
  tableBody.innerHTML = '';
  
  if (data.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5">No data available</td></tr>';
    return;
  }
  
  data.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${row.time}</td>
      <td>${row.temp.toFixed(1)}</td>
      <td>${row.hum.toFixed(1)}</td>
      <td>${row.loc}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function filterData() {
  const dateFilter = document.getElementById('dateFilter').value;
  const startHour = document.getElementById('startHour').value;
  const endHour = document.getElementById('endHour').value;
  
  let filteredData = allData;
  
  if (dateFilter) {
    filteredData = filteredData.filter(row => row.date === dateFilter);
  }
  
  if (startHour && endHour) {
    const start = parseInt(startHour);
    const end = parseInt(endHour);
    if (start <= end) {
      filteredData = filteredData.filter(row => {
        const hour = parseInt(row.time.split(':')[0]);
        return hour >= start && hour < end;
      });
    }
  } else if (startHour) {
    const hour = parseInt(startHour);
    filteredData = filteredData.filter(row => parseInt(row.time.split(':')[0]) === hour);
  } else if (endHour) {
    const hour = parseInt(endHour);
    filteredData = filteredData.filter(row => parseInt(row.time.split(':')[0]) < parseInt(endHour));
  }
  
  updateTable(filteredData);
}

function downloadCSV() {
  const tableBody = document.getElementById('tableBody');
  const rows = Array.from(tableBody.getElementsByTagName('tr'));
  
  if (rows.length === 0 || rows[0].textContent === 'No data available') {
    alert('No data to download');
    return;
  }
  
  const csvContent = [
    '"Date","Time","Temperature (°C)","Humidity (%)","Location"',
    ...rows.map(row => {
      const cells = row.getElementsByTagName('td');
      return `"${cells[0].textContent}","${cells[1].textContent}",${cells[2].textContent},${cells[3].textContent},"${cells[4].textContent}"`;
    })
  ].join('\n');
  
  const today = new Date().toISOString().split('T')[0];
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `climate_data_${today}.csv`;
  link.click();
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

function sortTable(column) {
  const sortKey = {
    date: 'date',
    time: 'time',
    temp: 'temp',
    hum: 'hum',
    loc: 'loc'
  }[column];
  
  allData.sort((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];
    
    if (sortKey === 'temp' || sortKey === 'hum') {
      return aValue - bValue;
    }
    return aValue.localeCompare(bValue);
  });
  
  filterData();
}

document.getElementById('refreshBtn').addEventListener('click', () => {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('error').style.display = 'none';
  fetchData();
});

document.getElementById('downloadBtn').addEventListener('click', downloadCSV);

document.getElementById('dateFilter').addEventListener('change', filterData);
document.getElementById('startHour').addEventListener('change', filterData);
document.getElementById('endHour').addEventListener('change', filterData);

document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => sortTable(th.getAttribute('data-sort')));
});

document.getElementById('loading').style.display = 'block';
fetchData();