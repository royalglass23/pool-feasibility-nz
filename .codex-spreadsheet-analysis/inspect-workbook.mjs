import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "D:/Royal Glass Dev/geomap/ROYAL GLASS SEO content topic 22072026.xlsx";
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "workbook,sheet,table",
  include: "id,name,values,formulas",
  maxChars: 30000,
  tableMaxRows: 20,
  tableMaxCols: 20,
  tableMaxCellChars: 160,
});

console.log(summary.ndjson);
