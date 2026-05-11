const SPREADSHEET_ID = '18als6GQWMmekFv39ECpgs4Dhq9Ej-Y_LHCD5IqdF3wA'; 
const TEMPLATE_ID = '10XmaWMX1JO9XXxadawHWGx4KFWFkW9BP4YgXqXKCA_g'; 
const FOLDER_NAME = '賣場簽名與合約存檔';

function getSS() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function doGet(e) {
  try {
    var page = (e && e.parameter && e.parameter.p) ? e.parameter.p : 'home';
    if (page === 'signoff') return HtmlService.createTemplateFromFile('Signoff').evaluate().setTitle('訂單簽收系統').addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0');
    if (page === 'finance') return HtmlService.createTemplateFromFile('Finance').evaluate().setTitle('財務管理系統').addMetaTag('viewport', 'width=device-width, initial-scale=1');
    return HtmlService.createTemplateFromFile('Index').evaluate().setTitle('公司福利社').addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0');
  } catch (error) { return ContentService.createTextOutput("系統發生錯誤: " + error.message); }
}
function forceAuth() {
  // 1. 觸發 DriveApp 權限
  DriveApp.getRootFolder();
  
  // 2. 觸發 MailApp 權限
  MailApp.getRemainingDailyQuota();
  
  // 3. 觸發 DocumentApp 與 刪除權限
  var doc = DocumentApp.create("權限測試用暫存檔"); // 建立文件
  var file = DriveApp.getFileById(doc.getId());    // 透過 ID 抓取檔案實體
  file.setTrashed(true);                           // 丟入垃圾桶
  
  console.log("權限檢查通過！");
}
// ------------------------------------------
// 1. 財務與權限
// ------------------------------------------
function verifyAdmin(code) {
  const sheet = getSS().getSheetByName('Employees');
  if (!sheet) return { success: false, error: "無資料表" };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(code).trim()) {
      return { success: true, role: String(data[i][4]).toLowerCase().trim(), name: data[i][0] };
    }
  }
  return { success: false, error: "權限不足" };
}

function getFinancialData() {
  const ss = getSS();
  let fSheet = ss.getSheetByName('FinancialReport');
  if (!fSheet) { fSheet = ss.insertSheet('FinancialReport'); fSheet.appendRow(['ID', '日期', '類型', '金額', '備註', '經手人']); }
  
  let records = [], income = 0, expense = 0, empUsage = 0, inventoryValue = 0;
  
  const data = fSheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    const amt = Number(data[i][3]) || 0;
    const type = data[i][2];
    if (type === '收入') income += amt;
    else if (type === '支出') expense += amt;
    else if (type === '員工核銷') empUsage += amt;
    
    if (records.length < 100) records.push({ id: data[i][0], date: Utilities.formatDate(new Date(data[i][1]), 'GMT+8', 'MM/dd'), type, amount: amt, note: data[i][4], recorder: data[i][5] });
  }

  const pSheet = ss.getSheetByName('Products');
  let products = [];
  if (pSheet) {
    const pData = pSheet.getDataRange().getValues();
    for (let i = 1; i < pData.length; i++) {
      const stock = Number(pData[i][6]) || 0;
      const cost = Number(pData[i][7]) || 0;
      inventoryValue += (stock * cost);
      products.push({ id: pData[i][0], name: pData[i][1], stock: stock, cost: cost });
    }
  }
  return { records, stats: { income, expense, empUsage, inventoryValue }, products };
}

function updateProductCost(id, cost, op) {
  if(!op) return {success:false};
  const sheet = getSS().getSheetByName('Products');
  const data = sheet.getDataRange().getValues();
  for(let i=1;i<data.length;i++) { if(String(data[i][0])==String(id)) { sheet.getRange(i+1,8).setValue(cost); return {success:true}; }}
  return {success:false};
}

function addFinancialRecord(d) {
  if(d.role!=='admin') return {success:false};
  const sheet = getSS().getSheetByName('FinancialReport');
  sheet.appendRow(['FIN'+Date.now(), new Date(), d.type, d.amount, d.note, d.recorder]);
  return {success:true};
}

function deleteFinancialRecord(id, op) {
  const lock = LockService.getScriptLock();
  if(!lock.tryLock(3000)) return {success:false, error:"Busy"};
  try {
    const ss = getSS();
    const sheet = ss.getSheetByName('FinancialReport');
    const data = sheet.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
      if(String(data[i][0])===String(id)) { sheet.deleteRow(i+1); return {success:true}; }
    }
    return {success:false, error:"Not found"};
  } finally { lock.releaseLock(); }
}

// ------------------------------------------
// 2. 訂單與PDF核心
// ------------------------------------------
function getProductList() {
  const sheet = getSS().getSheetByName('Products');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  data.shift(); 
  return data.map(r => ({ id: r[0], name: r[1], image: r[2], price: r[3], promoQty: r[4], promoPrice: r[5], stock: r[6] }));
}

function employeeLogin(code) {
  const sheet = getSS().getSheetByName('Employees');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(code).trim()) {
      return { success: true, name: data[i][0], balance: Number(data[i][2]) - Number(data[i][3]), code: data[i][1] };
    }
  }
  return { success: false, error: "代號錯誤" };
}

function submitOrder(d) { return processOrder(d, false); }
function submitEmployeeOrder(d) { return processOrder(d, true); }

function processOrder(d, isEmp) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, error: "系統忙碌" };
  try {
    const ss = getSS();
    const pSheet = ss.getSheetByName('Products');
    const pData = pSheet.getDataRange().getValues();
    let pRow = -1, stock = 0;
    
    for (let i = 1; i < pData.length; i++) { 
      if (pData[i][1] === d.productName) { pRow = i + 1; stock = Number(pData[i][6]); break; } 
    }
    if (pRow === -1) throw new Error("找不到商品");
    if (stock < d.qty) throw new Error("庫存不足");
    
    pSheet.getRange(pRow, 7).setValue(stock - d.qty);

    let pdfResult = { downloadUrl: "", emailStatus: "" };
    let pdfPayload = { ...d, signature: d.signature }; 

    if (isEmp) {
      const eSheet = ss.getSheetByName('Employees');
      const eData = eSheet.getDataRange().getValues();
      let eRow = -1;
      for (let i = 1; i < eData.length; i++) { if (String(eData[i][1]) === String(d.employeeCode)) { eRow = i + 1; break; } }
      if (eRow !== -1) {
        eSheet.getRange(eRow, 4).setValue(Number(eData[eRow-1][3]) + d.total);
        let fSheet = ss.getSheetByName('FinancialReport');
        if(!fSheet) fSheet=ss.insertSheet('FinancialReport');
        const empName = eData[eRow-1][0];
        fSheet.appendRow(['EMP'+Date.now(), new Date(), '員工核銷', d.total, `員工購: ${d.productName} x${d.qty}`, empName]);
        
        pdfPayload.name = empName + " (員工)";
        pdfResult = generatePDFAndSave(pdfPayload, 'Employees');
      }
    } else {
      let oSheet = ss.getSheetByName('Orders');
      if(!oSheet) { oSheet=ss.insertSheet('Orders'); oSheet.appendRow(['訂單ID','姓名','商品','數量','總價','Email','部門','日期','簽收狀態','PDF']); }
      
      pdfResult = generatePDFAndSave(pdfPayload, 'Orders');
      oSheet.appendRow(['ORD'+Date.now(), d.userName, d.productName, d.qty, d.total, d.userEmail, d.userDept, new Date(), '', pdfResult.downloadUrl]);
    }
    
    return { success: true, downloadUrl: pdfResult.downloadUrl, message: pdfResult.emailStatus };
  } catch (e) { return { success: false, error: e.message }; } finally { lock.releaseLock(); }
}

function findOrdersByName(k) {
  const sheet = getSS().getSheetByName('Orders');
  if(!sheet) return [];
  const data = sheet.getDataRange().getValues();
  // 讀取 Email (第6欄, index 5)
  return data.slice(1).filter(r => r[1].toString().includes(k) && r[8]==='').map(r => ({
    orderId: r[0], product: r[2], qty: r[3], total: r[4], 
    email: r[5] || "", // 確保如果是 undefined 會變空字串
    date: Utilities.formatDate(new Date(r[7]), 'GMT+8', 'MM/dd')
  }));
}

function submitSignoff(data) {
  const sheet = getSS().getSheetByName('Orders');
  const ids = data.orders.map(o => o.orderId);
  const rows = sheet.getDataRange().getValues();
  
  for(let i=1; i<rows.length; i++) {
    if(ids.includes(rows[i][0])) sheet.getRange(i+1, 9).setValue("已簽收");
  }

  let itemsString = data.orders.map(o => `[已簽收] ${o.product} x${o.qty}`).join("\n");
  
  // 找出有效的 Email (避免舊資料沒 Email)
  let targetEmail = "";
  for(let i=0; i<data.orders.length; i++){
    if(data.orders[i].email && data.orders[i].email.includes('@')){
      targetEmail = data.orders[i].email;
      break;
    }
  }

  const pdfRes = generatePDFAndSave({
    name: data.signerName, 
    productName: "批量簽收單", 
    itemsString: itemsString, 
    qty: data.orders.length,
    total: data.orders.reduce((a,b)=>a+Number(b.total),0),
    signature: data.signature,
    userEmail: targetEmail
  }, 'Signoffs');

  return { success: true, downloadUrl: pdfRes.downloadUrl, message: pdfRes.emailStatus };
}

function generatePDFAndSave(payload, type) {
  let emailStatus = "未寄信 (無 Email)";
  try {
    const timestamp = new Date();
    const folder = DriveApp.getFoldersByName(FOLDER_NAME).hasNext() ? DriveApp.getFoldersByName(FOLDER_NAME).next() : DriveApp.createFolder(FOLDER_NAME);
    const template = DriveApp.getFileById(TEMPLATE_ID);
    const newFile = template.makeCopy(`${type}_${Utilities.formatDate(timestamp,'GMT+8','yyyyMMddHHmm')}_${payload.name}`, folder);
    const doc = DocumentApp.openById(newFile.getId());
    const body = doc.getBody();

    body.replaceText('{{NAME}}', payload.userName || payload.name || '');
    body.replaceText('{{ITEM}}', payload.productName || payload.itemsString || '');
    body.replaceText('{{QTY}}', payload.qty || '');
    body.replaceText('{{TOTAL}}', payload.total || '');
    body.replaceText('{{DATE}}', Utilities.formatDate(timestamp, 'GMT+8', 'yyyy/MM/dd HH:mm'));
    body.replaceText('{{DEPT}}', payload.userDept || '');
    body.replaceText('{{EMAIL}}', payload.userEmail || payload.email || '');

    if (payload.signature && payload.signature.startsWith('data:image')) {
      const base64Data = payload.signature.split(',')[1];
      const decoded = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(decoded, MimeType.PNG, "signature.png");
      const range = body.findText('{{SIGNATURE}}');
      if (range) {
        range.getElement().setText('');
        range.getElement().getParent().asParagraph().insertInlineImage(0, blob).setWidth(150).setHeight(80); 
      } else {
        body.appendParagraph("簽名：").appendImage(blob).setWidth(150).setHeight(80);
      }
    } else {
      body.replaceText('{{SIGNATURE}}', '');
    }

    doc.saveAndClose();
    const pdfBlob = newFile.getAs(MimeType.PDF);
    const pdfFile = folder.createFile(pdfBlob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    newFile.setTrashed(true); 

    // 強制寄信測試
    const emailTo = payload.userEmail || payload.email;
    if (emailTo && emailTo.includes('@')) {
      try { 
        MailApp.sendEmail({ 
          to: emailTo, 
          subject: `【訂單通知】${type} - ${payload.name}`, 
          body: `您好，附件為您的文件。\n時間：${Utilities.formatDate(timestamp, 'GMT+8', 'yyyy/MM/dd HH:mm')}`, 
          attachments: [pdfBlob] 
        }); 
        emailStatus = "已寄出至 " + emailTo;
      } catch(e){ 
        console.error("Mail Error: " + e.message);
        emailStatus = "寄信失敗: " + e.message;
      }
    } else {
      console.log("No valid email found in payload");
    }

    return { success: true, downloadUrl: pdfFile.getDownloadUrl(), emailStatus: emailStatus };
  } catch (e) {
    console.error("PDF/System Error: " + e.message);
    return { success: false, downloadUrl: "", emailStatus: "系統錯誤: " + e.message };
  }
}