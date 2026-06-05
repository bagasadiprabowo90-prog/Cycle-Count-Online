export interface Product {
  barcode: string;
  sku: string;
  product: string;
  batch: string;
}

export interface Transaction {
  id: string; // epoch string
  type: 'IN' | 'CC';
  date: string; // M/D/YYYY
  barcode: string;
  sku: string;
  product: string;
  batch: string;
  qty: number;
  user: string;
  timestamp: number;
}
