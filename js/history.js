const SHEET_ID = '16SUgOaXTlA_Nf_YO9q0ZpEAiRRpheRUWdpfSEy7YYCc';
const SHEET_NAME = 'Temp Sensor Data';
const ITEMS_PER_PAGE = 50;

let allData = [];
let filteredData = [];
let currentPage = 1;

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
  
  currentPage = 1;
  filteredData = allData;
  if (allData.length > 0) {
    updateTable();
  } else {
    handleError(new Error('No valid data rows found'));
  }
}

function updateTable() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'none';
  
  const tableBody = document.getElementById('tableBody');
  tableBody.innerHTML = '';
  
  if (filteredData.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5">No data available</td></tr>';
    updatePagination();
    return;
  }
  
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = Math.min(start + ITEMS_PER_PAGE, filteredData.length);
  const paginatedData = filteredData.slice(start, end);
  
  paginatedData.forEach(row => {
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
  
  updatePagination();
}

function updatePagination() {
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}, Showing ${Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredData.length)}–${Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} of ${filteredData.length} readings`;
  
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage >= totalPages || totalPages === 0;
}

function filterData() {
  const dateFilter = document.getElementById('dateFilter').value;
  const startHour = document.getElementById('startHour').value;
  const endHour = document.getElementById('endHour').value;
  
  filteredData = allData;
  
  if (dateFilter) {
    filteredData = filteredData.filter(row => row.date === dateFilter);
  }
  
  if (startHour || endHour) {
    const start = startHour ? parseInt(startHour) : 0;
    const end = endHour ? parseInt(endHour) : 23;
    filteredData = filteredData.filter(row => {
      const hour = parseInt(row.time.split(':')[0]);
      return hour >= start && hour <= end;
    });
  }
  
  currentPage = 1;
  updateTable();
}

function clearFilters() {
  document.getElementById('dateFilter').value = '';
  document.getElementById('startHour').value = '';
  document.getElementById('endHour').value = '';
  filteredData = allData;
  currentPage = 1;
  updateTable();
}

function downloadCSV() {
  if (filteredData.length === 0) {
    alert('No data to download');
    return;
  }
  
  const csvContent = [
    '"Date","Time","Temperature (°C)","Humidity (%)","Location"',
    ...filteredData.map(row => `"${row.date}","${row.time}",${row.temp.toFixed(1)},${row.hum.toFixed(1)},"${row.loc}"`)
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
  
  filteredData.sort((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];
    
    if (sortKey === 'temp' || sortKey === 'hum') {
      return aValue - bValue;
    }
    return aValue.localeCompare(bValue);
  });
  
  currentPage = 1;
  updateTable();
}

document.getElementById('refreshBtn').addEventListener('click', () => {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('error').style.display = 'none';
  fetchData();
});

document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);
document.getElementById('downloadBtn').addEventListener('click', downloadCSV);

document.getElementById('dateFilter').addEventListener('change', filterData);
document.getElementById('startHour').addEventListener('change', filterData);
document.getElementById('endHour').addEventListener('change', filterData);

document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => sortTable(th.getAttribute('data-sort')));
});

document.getElementById('prevBtn').addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    updateTable();
  }
});

document.getElementById('nextBtn').addEventListener('click', () => {
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  if (currentPage < totalPages) {
    currentPage++;
    updateTable();
  }
});

document.getElementById('loading').style.display = 'block';
fetchData();