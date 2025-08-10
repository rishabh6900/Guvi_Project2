document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const optionsSection = document.getElementById('optionsSection');
    const resultSection = document.getElementById('resultSection');
    const previewTable = document.getElementById('previewTable');
    const missingValues = document.getElementById('missingValues');
    const resultTable = document.getElementById('resultTable');
    const cleanBtn = document.getElementById('cleanBtn');
    const downloadLink = document.getElementById('downloadLink');
    const newFileBtn = document.getElementById('newFileBtn');
    const loading = document.getElementById('loading');
    const methodOptions = document.querySelectorAll('.method-option input');
    
    // Application State
    let currentFile = null;
    let dataset = null;
    let cleanedDataset = null;
    
    // Event Listeners
    setupEventListeners();
    
    function setupEventListeners() {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });
        
        // Highlight drop area
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, unhighlight, false);
        });
        
        // Handle dropped files
        dropArea.addEventListener('drop', handleDrop, false);
        
        // Handle file selection
        fileInput.addEventListener('change', function() {
            if (this.files.length) {
                handleFiles(this.files);
            }
        });
        
        // Clean button click
        cleanBtn.addEventListener('click', cleanData);
        
        // New file button
        newFileBtn.addEventListener('click', resetApplication);
        
        // Method selection to show/hide KNN parameters
        methodOptions.forEach(option => {
            option.addEventListener('change', function() {
                const knnParams = this.closest('.method-option').querySelector('.knn-params');
                if (knnParams) {
                    knnParams.style.display = this.value === 'knn' ? 'block' : 'none';
                }
            });
        });
    }
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() {
        dropArea.classList.add('highlight');
    }
    
    function unhighlight() {
        dropArea.classList.remove('highlight');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }
    
    function handleFiles(files) {
        if (files.length > 1) {
            alert('Please upload only one file at a time.');
            return;
        }
        
        currentFile = files[0];
        
        // Validate file type
        if (!currentFile.name.match(/\.(csv|txt)$/i)) {
            alert('Please upload a CSV file.');
            return;
        }
        
        showLoading(true);
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                parseCSV(e.target.result);
                showLoading(false);
            } catch (error) {
                showLoading(false);
                alert('Error parsing file: ' + error.message);
                console.error(error);
            }
        };
        
        reader.onerror = function() {
            showLoading(false);
            alert('Error reading file');
        };
        
        reader.readAsText(currentFile);
    }
    
    function parseCSV(content) {
        // Improved CSV parsing with quote handling
        const lines = content.split('\n').filter(line => line.trim() !== '');
        const headers = parseCSVLine(lines[0]);
        
        dataset = {
            headers: headers,
            rows: [],
            stats: {
                totalRows: lines.length - 1,
                missingValues: {}
            }
        };
        
        // Parse rows and collect stats
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            dataset.rows.push(values);
            
            // Track missing values
            values.forEach((val, idx) => {
                if (val === '') {
                    if (!dataset.stats.missingValues[headers[idx]]) {
                        dataset.stats.missingValues[headers[idx]] = 0;
                    }
                    dataset.stats.missingValues[headers[idx]]++;
                }
            });
        }
        
        displayPreview();
        analyzeMissingValues();
        optionsSection.style.display = 'block';
    }
    
    function parseCSVLine(line) {
        // Simple CSV line parser that handles quoted values
        const result = [];
        let inQuotes = false;
        let currentField = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(currentField.trim());
                currentField = '';
            } else {
                currentField += char;
            }
        }
        
        // Add the last field
        result.push(currentField.trim());
        
        return result;
    }
    
    function displayPreview() {
        const displayRows = dataset.rows.slice(0, 5);
        const headers = dataset.headers;
        
        let tableHTML = '<table><thead><tr>';
        
        // Headers
        headers.forEach(header => {
            tableHTML += `<th>${escapeHTML(header)}</th>`;
        });
        
        tableHTML += '</tr></thead><tbody>';
        
        // Rows
        displayRows.forEach(row => {
            tableHTML += '<tr>';
            row.forEach((cell, colIndex) => {
                const isMissing = cell === '';
                const displayValue = isMissing ? '<span class="missing">NaN</span>' : escapeHTML(cell);
                tableHTML += `<td${isMissing ? ' class="missing-cell"' : ''}>${displayValue}</td>`;
            });
            tableHTML += '</tr>';
        });
        
        tableHTML += '</tbody></table>';
        previewTable.innerHTML = tableHTML;
    }
    
    function analyzeMissingValues() {
        const headers = dataset.headers;
        const missingStats = dataset.stats.missingValues;
        const totalRows = dataset.stats.totalRows;
        
        let missingHTML = `
            <h4><span class="stats-icon">📊</span> Dataset Statistics</h4>
            <div class="stats-summary">
                <div>Total Rows: <strong>${totalRows}</strong></div>
                <div>Total Columns: <strong>${headers.length}</strong></div>
            </div>
            <h4><span class="stats-icon">⚠️</span> Missing Values</h4>
            <ul class="missing-stats">`;
        
        headers.forEach(header => {
            const missingCount = missingStats[header] || 0;
            const percentage = ((missingCount / totalRows) * 100).toFixed(1);
            
            missingHTML += `
                <li>
                    <span class="column-name">${escapeHTML(header)}</span>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${percentage}%"></div>
                    </div>
                    <span class="missing-count">${missingCount} (${percentage}%)</span>
                </li>`;
        });
        
        missingHTML += '</ul>';
        missingValues.innerHTML = missingHTML;
    }
    
    function cleanData() {
        const method = document.querySelector('input[name="method"]:checked').value;
        let knnNeighbors = 5;
        
        if (method === 'knn') {
            const knnInput = document.querySelector('.knn-params input');
            knnNeighbors = parseInt(knnInput.value) || 5;
        }
        
        showLoading(true);
        cleanBtn.disabled = true;
        
        // Simulate processing delay (replace with actual processing)
        setTimeout(() => {
            try {
                cleanedDataset = processData(method, knnNeighbors);
                displayResults();
                prepareDownload();
                
                optionsSection.style.display = 'none';
                resultSection.style.display = 'block';
            } catch (error) {
                alert('Error during cleaning: ' + error.message);
                console.error(error);
            } finally {
                showLoading(false);
                cleanBtn.disabled = false;
            }
        }, 1500);
    }
    
    function processData(method, knnNeighbors = 5) {
        // Create a deep copy of the dataset
        const result = {
            headers: [...dataset.headers],
            rows: dataset.rows.map(row => [...row]),
            stats: {
                totalRows: dataset.stats.totalRows,
                missingValues: {...dataset.stats.missingValues}
            }
        };
        
        // For demo purposes, we'll implement mean, median, mode, and drop
        // In a real app, you would implement all methods properly
        
        if (method === 'drop') {
            // Drop rows with any missing values
            result.rows = result.rows.filter(row => 
                !row.some(cell => cell === '')
            );
            result.stats.totalRows = result.rows.length;
            return result;
        }
        
        // Calculate fill values for each column
        const fillValues = {};
        
        result.headers.forEach((header, colIndex) => {
            const values = result.rows.map(row => row[colIndex]).filter(val => val !== '');
            
            if (values.length === 0) {
                fillValues[colIndex] = ''; // No non-missing values
                return;
            }
            
            // Try to parse as number
            const numericValues = values.map(val => {
                const num = parseFloat(val);
                return isNaN(num) ? val : num;
            });
            
            const isNumeric = numericValues.every(val => typeof val === 'number');
            
            if (isNumeric) {
                if (method === 'mean') {
                    const sum = numericValues.reduce((a, b) => a + b, 0);
                    fillValues[colIndex] = sum / numericValues.length;
                } else if (method === 'median') {
                    const sorted = [...numericValues].sort((a, b) => a - b);
                    const mid = Math.floor(sorted.length / 2);
                    fillValues[colIndex] = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
                } else if (method === 'mode' || method === 'knn') {
                    // For demo, we'll use mode for KNN too
                    const frequency = {};
                    let max = 0;
                    let mode = numericValues[0];
                    
                    numericValues.forEach(num => {
                        frequency[num] = (frequency[num] || 0) + 1;
                        
                        if (frequency[num] > max) {
                            max = frequency[num];
                            mode = num;
                        }
                    });
                    
                    fillValues[colIndex] = mode;
                }
            } else {
                // For non-numeric columns
                if (method === 'mode' || method === 'knn') {
                    const frequency = {};
                    let max = 0;
                    let mode = values[0];
                    
                    values.forEach(val => {
                        frequency[val] = (frequency[val] || 0) + 1;
                        
                        if (frequency[val] > max) {
                            max = frequency[val];
                            mode = val;
                        }
                    });
                    
                    fillValues[colIndex] = mode;
                }
            }
        });
        
        // Apply fill values
        result.rows.forEach(row => {
            result.headers.forEach((header, colIndex) => {
                if (row[colIndex] === '' && fillValues[colIndex] !== undefined) {
                    row[colIndex] = fillValues[colIndex];
                    
                    // Format numbers if needed
                    if (typeof fillValues[colIndex] === 'number') {
                        row[colIndex] = parseFloat(fillValues[colIndex].toFixed(4));
                    }
                }
            });
        });
        
        // Update stats
        result.stats.missingValues = {};
        
        return result;
    }
    
    function displayResults() {
        const displayRows = cleanedDataset.rows.slice(0, 10); // Show more rows in results
        const headers = cleanedDataset.headers;
        
        let tableHTML = '<table><thead><tr>';
        
        // Headers
        headers.forEach(header => {
            tableHTML += `<th>${escapeHTML(header)}</th>`;
        });
        
        tableHTML += '</tr></thead><tbody>';
        
        // Rows
        displayRows.forEach(row => {
            tableHTML += '<tr>';
            row.forEach(cell => {
                tableHTML += `<td>${escapeHTML(cell.toString())}</td>`;
            });
            tableHTML += '</tr>';
        });
        
        tableHTML += '</tbody></table>';
        resultTable.innerHTML = tableHTML;
    }
    
    function prepareDownload() {
        // Convert to CSV
        let csvContent = cleanedDataset.headers.join(',') + '\n';
        
        cleanedDataset.rows.forEach(row => {
            csvContent += row.map(field => {
                // Quote fields containing commas or newlines
                if (typeof field === 'string' && (field.includes(',') || field.includes('\n'))) {
                    return `"${field.replace(/"/g, '""')}"`;
                }
                return field;
            }).join(',') + '\n';
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        downloadLink.href = url;
        downloadLink.download = currentFile.name.replace(/(\.\w+)?$/, '_cleaned.csv');
    }
    
    function resetApplication() {
        // Reset the UI
        optionsSection.style.display = 'none';
        resultSection.style.display = 'none';
        previewTable.innerHTML = '';
        missingValues.innerHTML = '';
        resultTable.innerHTML = '';
        fileInput.value = '';
        
        // Reset state
        currentFile = null;
        dataset = null;
        cleanedDataset = null;
    }
    
    function showLoading(show) {
        loading.style.display = show ? 'block' : 'none';
    }
    
    function escapeHTML(str) {
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});