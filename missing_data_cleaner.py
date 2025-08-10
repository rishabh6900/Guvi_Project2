import pandas as pd
import numpy as np
import os
from sklearn.experimental import enable_iterative_imputer
from sklearn.impute import IterativeImputer, KNNImputer
from typing import Union, Dict, Optional, List

class MissingDataCleaner:
    """Enhanced missing data cleaner with multiple imputation methods"""
    
    def __init__(self, file_path: str):
        """Initialize with file path"""
        self.file_path = file_path
        self.df = None
        self.cleaned_df = None
        self.missing_counts = None
        self.numeric_columns = None
        
    def load_data(self) -> bool:
        """Load data from various file formats"""
        try:
            if self.file_path.endswith('.csv'):
                self.df = pd.read_csv(self.file_path)
            elif self.file_path.endswith(('.xlsx', '.xls')):
                self.df = pd.read_excel(self.file_path)
            elif self.file_path.endswith('.json'):
                self.df = pd.read_json(self.file_path)
            else:
                raise ValueError("Unsupported file format")
            
            # Identify numeric columns for imputation methods
            self.numeric_columns = self.df.select_dtypes(include=np.number).columns.tolist()
            return True
        except Exception as e:
            print(f"Error loading file: {e}")
            return False
    
    def analyze_missing_data(self) -> Dict[str, int]:
        """Analyze and return missing data statistics"""
        if self.df is None:
            return {}
            
        self.missing_counts = self.df.isnull().sum().to_dict()
        return self.missing_counts
    
    def apply_knn_imputation(self, n_neighbors: int = 5) -> pd.DataFrame:
        """
        Apply KNN imputation to numeric columns
        
        Args:
            n_neighbors: Number of neighbors to use for imputation
            
        Returns:
            DataFrame with missing values imputed
        """
        if not self.numeric_columns:
            return self.df.copy()
            
        imputer = KNNImputer(n_neighbors=n_neighbors)
        df_imputed = self.df.copy()
        df_imputed[self.numeric_columns] = imputer.fit_transform(df_imputed[self.numeric_columns])
        return df_imputed
    
    def clean_data(
        self,
        method: str = 'mean',
        columns: Optional[List[str]] = None,
        **kwargs
    ) -> pd.DataFrame:
        """
        Clean missing data using specified method
        
        Args:
            method: One of 'mean', 'median', 'mode', 'knn', 'iterative', 'ffill', 'bfill', 'drop'
            columns: Specific columns to clean (None for all)
            **kwargs: Additional method-specific parameters
        
        Returns:
            Cleaned DataFrame
        """
        if self.df is None:
            raise ValueError("No data loaded")
            
        if method == 'knn':
            n_neighbors = kwargs.get('n_neighbors', 5)
            self.cleaned_df = self.apply_knn_imputation(n_neighbors=n_neighbors)
            return self.cleaned_df
            
        df = self.df.copy()
        columns = columns if columns else df.columns
        
        for col in columns:
            if col not in df.columns:
                continue
                
            if method == 'mean' and pd.api.types.is_numeric_dtype(df[col]):
                fill_value = df[col].mean()
                df[col].fillna(fill_value, inplace=True)
            elif method == 'median' and pd.api.types.is_numeric_dtype(df[col]):
                fill_value = df[col].median()
                df[col].fillna(fill_value, inplace=True)
            elif method == 'mode':
                fill_value = df[col].mode()[0]
                df[col].fillna(fill_value, inplace=True)
            elif method == 'iterative':
                max_iter = kwargs.get('max_iter', 10)
                imputer = IterativeImputer(max_iter=max_iter, random_state=0)
                df[self.numeric_columns] = imputer.fit_transform(df[self.numeric_columns])
            elif method == 'ffill':
                df[col].fillna(method='ffill', inplace=True)
            elif method == 'bfill':
                df[col].fillna(method='bfill', inplace=True)
            elif method == 'drop':
                threshold = kwargs.get('threshold', 0.5)
                if df[col].isnull().mean() > threshold:
                    df.drop(col, axis=1, inplace=True)
                else:
                    df.dropna(subset=[col], inplace=True)
        
        self.cleaned_df = df
        return df
    
    def save_cleaned_data(self, output_path: Optional[str] = None) -> str:
        """Save cleaned data to file"""
        if self.cleaned_df is None:
            raise ValueError("No cleaned data available")
            
        if not output_path:
            dir_name, file_name = os.path.split(self.file_path)
            name, ext = os.path.splitext(file_name)
            output_path = os.path.join(dir_name, f"{name}_cleaned{ext}")
        
        try:
            if output_path.endswith('.csv'):
                self.cleaned_df.to_csv(output_path, index=False)
            elif output_path.endswith(('.xlsx', '.xls')):
                self.cleaned_df.to_excel(output_path, index=False)
            elif output_path.endswith('.json'):
                self.cleaned_df.to_json(output_path, orient='records')
            else:
                raise ValueError("Unsupported output format")
            return output_path
        except Exception as e:
            print(f"Error saving file: {e}")
            raise

    def get_column_stats(self) -> Dict[str, Dict[str, Union[str, int, float]]]:
        """Get statistics for each column"""
        if self.df is None:
            return {}
            
        stats = {}
        for col in self.df.columns:
            col_stats = {
                'dtype': str(self.df[col].dtype),
                'missing': self.df[col].isnull().sum(),
                'unique': self.df[col].nunique(),
            }
            
            if pd.api.types.is_numeric_dtype(self.df[col]):
                col_stats.update({
                    'mean': self.df[col].mean(),
                    'median': self.df[col].median(),
                    'min': self.df[col].min(),
                    'max': self.df[col].max(),
                    'std': self.df[col].std()
                })
            else:
                col_stats['mode'] = self.df[col].mode()[0]
                
            stats[col] = col_stats
            
        return stats
    
    def get_knn_recommendation(self) -> Dict:
        """Get recommendation for KNN imputation parameters"""
        if not self.numeric_columns:
            return {'recommended': False, 'reason': 'No numeric columns found'}
            
        missing_stats = {col: self.df[col].isnull().sum() for col in self.numeric_columns}
        total_missing = sum(missing_stats.values())
        
        if total_missing == 0:
            return {'recommended': False, 'reason': 'No missing values in numeric columns'}
            
        # Simple heuristic for neighbor count
        n_samples = len(self.df)
        recommended_neighbors = max(3, min(10, int(np.sqrt(n_samples))))
        
        return {
            'recommended': True,
            'n_neighbors': recommended_neighbors,
            'missing_stats': missing_stats,
            'numeric_columns': self.numeric_columns
        }