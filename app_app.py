from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
from missing_data_cleaner import MissingDataCleaner
import tempfile
import uuid
import numpy as np

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = tempfile.gettempdir()
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB limit
app.config['SECRET_KEY'] = str(uuid.uuid4())

# Allowed file extensions
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls', 'json'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        cleaner = MissingDataCleaner(filepath)
        if not cleaner.load_data():
            return jsonify({'error': 'Error loading file'}), 400
        
        # Get file info and stats
        missing_counts = cleaner.analyze_missing_data()
        column_stats = cleaner.get_column_stats()
        
        # Sample data for preview
        preview_data = cleaner.df.head(10).replace({np.nan: None}).to_dict(orient='records')
        columns = list(cleaner.df.columns)
        
        return jsonify({
            'filename': filename,
            'preview': preview_data,
            'columns': columns,
            'missing_counts': missing_counts,
            'column_stats': column_stats,
            'shape': {'rows': cleaner.df.shape[0], 'cols': cleaner.df.shape[1]}
        })
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/analyze', methods=['POST'])
def analyze_data():
    """Endpoint to analyze data and provide cleaning recommendations"""
    data = request.get_json()
    if not data or 'filename' not in data:
        return jsonify({'error': 'Invalid request'}), 400
    
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], data['filename'])
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    cleaner = MissingDataCleaner(filepath)
    if not cleaner.load_data():
        return jsonify({'error': 'Error loading file'}), 400
    
    # Get analysis results
    missing_counts = cleaner.analyze_missing_data()
    column_stats = cleaner.get_column_stats()
    knn_recommendation = cleaner.get_knn_recommendation()
    
    return jsonify({
        'missing_counts': missing_counts,
        'column_stats': column_stats,
        'knn_recommendation': knn_recommendation,
        'preview': cleaner.df.head(10).replace({np.nan: None}).to_dict(orient='records'),
        'columns': list(cleaner.df.columns)
    })

@app.route('/clean', methods=['POST'])
def clean_data():
    """Enhanced cleaning endpoint with KNN support"""
    data = request.get_json()
    if not data or 'filename' not in data or 'method' not in data:
        return jsonify({'error': 'Invalid request'}), 400
    
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], data['filename'])
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    cleaner = MissingDataCleaner(filepath)
    if not cleaner.load_data():
        return jsonify({'error': 'Error loading file'}), 400
    
    try:
        method = data['method']
        params = data.get('params', {})
        columns = data.get('columns')
        
        if method == 'knn':
            cleaner.clean_data(method='knn', **params)
        else:
            cleaner.clean_data(method=method, columns=columns, **params)
        
        # Save and return results
        output_filename = f"cleaned_{data['filename']}"
        output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
        cleaner.save_cleaned_data(output_path)
        
        return jsonify({
            'success': True,
            'cleaned_filename': output_filename,
            'preview': cleaner.cleaned_df.head(10).replace({np.nan: None}).to_dict(orient='records')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download/<filename>')
def download_file(filename):
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    return send_file(
        filepath,
        as_attachment=True,
        download_name=filename,
        mimetype='application/octet-stream'
    )

@app.route('/cleanup', methods=['POST'])
def cleanup_files():
    data = request.get_json()
    if not data or 'filenames' not in data:
        return jsonify({'error': 'Invalid request'}), 400
    
    for filename in data['filenames']:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except:
                pass
    
    return jsonify({'message': 'Cleanup complete'})

if __name__ == '__main__':
    app.run(debug=True)