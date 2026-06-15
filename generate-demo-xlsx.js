const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const data = [
  {
    'Asset Name': 'MacBook Pro 16"',
    'Asset Tag': 'TAG-MBP16-001',
    'Serial': 'C02F1234MD6R',
    'Category': 'Laptops',
    'Model': 'MacBook Pro 16 M3 Max',
    'Status': 'Ready to Deploy',
    'Company': 'Maphy Corp',
    'Location': 'Headquarters Office',
    'Supplier': 'Apple Store',
    'Purchase Date': '2026-01-15',
    'Purchase Cost': 3499.00,
    'Warranty Months': 36,
    'GST': 18.00,
    'Order Number': 'PO-99182',
    'Notes': 'High performance engineering laptop'
  },
  {
    'Asset Name': 'Dell UltraSharp 32"',
    'Asset Tag': 'TAG-MON32-002',
    'Serial': 'CN012345XYZ678',
    'Category': 'Monitors',
    'Model': 'Dell U3223QE',
    'Status': 'Ready to Deploy',
    'Company': 'Maphy Corp',
    'Location': 'Headquarters Office',
    'Supplier': 'Dell Technologies',
    'Purchase Date': '2026-02-10',
    'Purchase Cost': 799.50,
    'Warranty Months': 24,
    'GST': 18.00,
    'Order Number': 'PO-99183',
    'Notes': '4K USB-C hub monitor for design team'
  },
  {
    'Asset Name': 'Logitech MX Keys Keyboard',
    'Asset Tag': 'TAG-KEY-003',
    'Serial': '2138LZ012345',
    'Category': 'Keyboards',
    'Model': 'MX Keys S',
    'Status': 'Ready to Deploy',
    'Company': 'Maphy Corp',
    'Location': 'Headquarters Office',
    'Supplier': 'Amazon Business',
    'Purchase Date': '2026-03-01',
    'Purchase Cost': 109.99,
    'Warranty Months': 12,
    'GST': 18.00,
    'Order Number': 'PO-99184',
    'Notes': 'Wireless membrane keyboard'
  }
];

// Create workbook
const wb = xlsx.utils.book_new();
const ws = xlsx.utils.json_to_sheet(data);
xlsx.utils.book_append_sheet(wb, ws, 'Bulk Import Template');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const outputPath = path.join(uploadsDir, 'assets_bulk_import_template.xlsx');
xlsx.writeFile(wb, outputPath);
console.log('Successfully generated spreadsheet at:', outputPath);
