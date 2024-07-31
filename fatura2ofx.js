// ==UserScript==
// @name     Fatura 2 OFX
// @version  1
// @grant    none
// ==/UserScript==

////////////////////////////////////////////////////////////////////////////////
// SCRAPING FUNCTIONS
//
// These operations are responsible to take data from the HTML from the Itaú
// site into an object.
////////////////////////////////////////////////////////////////////////////////

/**
 * `scrapeOFXData()` returns an object with all relevant infromation to build an
 * OFX file. It expects to receive a DOM object:
 *
 * > const fs = require('fs');
 * . const {JSDOM} = require('jsdom');
 * . const html = fs.readFileSync('pagina-fatura-exemplo.html', 'utf-8');
 * . const document = new JSDOM(html).window.document;
 * . const ofxData = scrapeOFXData(document);
 * //
 *
 * The object has to have the following properties:
 *
 * 1. The time it was created:
 *
 *    > const creationDate = ofxData.DTSERVER;
 *    //
 *    > creationDate.getTime() - new Date().getTime() < 1000
 *    true
 *
 * 2. The due date:
 *
 *    > const dueDate = ofxData.dueDate;
 *    //
 *    > dueDate.toISOString().slice(0,10)
 *    '2020-07-15'
 *
 * 3. A list of transactions:
 *
 *    > const transactions = ofxData.BANKTRANLIST;
 *    //
 *    > transactions.length
 *    4
 */
function scrapeOFXData(document) {
  return {
    DTSERVER: new Date(),
    BANKTRANLIST: scrapeBankTranList(document),
    dueDate: scrapeDueDate(document),
  };
}

/**
 * `scrapeBankTranList()` returns a list of transactions from the page:
 *
 * > const transactionList = scrapeBankTranList(document);
 * //
 * > transactionList.length
 * 4
 * > transactionList.map(t => t.MEMO)
 * ['PAGAMENTO EFETUADO', 'Amazon Br         03/04', 'Tim*61981548988', 'Pinboard']
 * > transactionList.map(t => t.DTPOSTED.toISOString().slice(0,10))
 * ['2020-06-17', '2020-04-23', '2020-06-06', '2020-07-06']
 * > transactionList.map(t => t.TRNAMT)
 * [-10823.97, 58.14, 15, 127.82]
 *
 * Each object should have the value of the transaction, the date of the
 * transaction (wiht an year based on the due date) and the description of the
 * transaction:
 *
 * > transactionList[0].TRNAMT
 * -10823.97
 * > transactionList[0].DTPOSTED.toISOString().slice(0,10)
 * '2020-06-17'
 * > transactionList[0].MEMO
 * 'PAGAMENTO EFETUADO'
 */
function scrapeBankTranList(document) {
  const transactionNodes = findTransactionNodes(document);

  const dueDate = scrapeDueDate(document);

  const bankTranList = [...transactionNodes]
    .map(e => scrapeStmtTrnFromNode(e, dueDate.getFullYear()));

  return bankTranList;
}

/**
 * `scrapeStmtTrnFromNode` converts a `table` node with all necessary elements
 * into an STMTTRN object. To do that, it needs the node with the data, and also
 * the year, since this is not part of the date found in the transaction:
 *
 * > const stmtTrn = scrapeStmtTrnFromNode(
 * .   document.getElementsByClassName('FATURA2OFX_TEST_EXPENSE1')[0], 2019)
 * //
 * > stmtTrn.TRNAMT
 * 58.14
 * > stmtTrn.DTPOSTED.toISOString().slice(0,10)
 * '2019-04-23'
 * > stmtTrn.MEMO
 * 'Amazon Br         03/04'
 */
function scrapeStmtTrnFromNode(node, year) {
  const TRNAMT = parseFloat(
    [...findTrnamtTd(node).querySelectorAll('span:not([aria-hidden="true"])')]
      .map(e => extractDecimalCommaString(e.textContent))
      .filter(e => Boolean(e))[0]
  );
  const MEMO = node
    .getElementsByClassName('fatura__table-col-dsc')[0]
    .textContent
    .trim();
  const DTPOSTED = parseDateFromDaySlashMonth(
    node
      .getElementsByClassName('fatura__table-col-data')[0]
      .textContent
      .trim(),
    year,
  );

  return {
    DTPOSTED,
    MEMO,
    TRNAMT,
  };
}

/**
 * `scrapeDueDate()` extracts the due date from the DOM object:
 *
 * > scrapeDueDate(document).toISOString().slice(0,10)
 * '2020-07-15'
 */
function scrapeDueDate(document) {
  const extractedDate = document
    .getElementsByClassName('c-category-status__venc')[0]
    .getElementsByClassName('c-category-status__value')[0]
    .textContent;

  return parseDateFromDaySlashMonthSlashYear(extractedDate);
}

/**
 * In the bank page, every transactions comes inside a `<tbody>` element.
 * `findTransactionNodes()` will return every one of these elements:
 *
 * > const nodes = findTransactionNodes(document);
 * //
 * > nodes.length
 * 4
 * > nodes.map(e => e.tagName)
 * ['TBODY', 'TBODY', 'TBODY', 'TBODY']
 *
 * These should also have at least one of the table cells with the expected
 * values: date, description and value:
 *
 * > nodes.map(e => !!e.getElementsByClassName('fatura__table-col-data'))
 * [true, true, true, true]
 * > nodes.map(e => !!e.getElementsByClassName('fatura__table-col-desc'))
 * [true, true, true, true]
 * > nodes.map(e => !!e.getElementsByClassName('fatura__table-col-num'))
 * [true, true, true, true]
 */
function findTransactionNodes(document) {
  const dateNodes = document
    .getElementsByClassName('fatura__table-col-dsc');

  const transactionNodes = [...dateNodes]
    .map(e => e.closest('tbody'))
    .filter(firstOccurence);

  return transactionNodes;
}

/**
 * `findTrnamtTd` queries a `tbody` element to find which `td` has the correct
 * value:
 *
 * > const trnamtTd = findTrnamtTd(
 * .    document.getElementsByClassName('FATURA2OFX_TEST_EXPENSE1')[0]);
 * //
 * > extractDecimalCommaString(trnamtTd.textContent)
 * "58.14"
 *
 * If it is an expense in foreign currency, it should get the cell with the
 * total value in reais:
 *
 * > const trnamtTdDollar = findTrnamtTd(
 * .    document.getElementsByClassName('FATURA2OFX_TEST_EXPENSE_DOLLAR')[0]);
 * //
 * > extractDecimalCommaString(trnamtTdDollar.textContent)
 * "127.82"
 */
function findTrnamtTd(node) {
  return [...node.getElementsByTagName('tr')]
    .filter(e => e.querySelector('.fatura__table-col-dsc'))[0]
    .getElementsByClassName('fatura__table-col-num')[0];
}

/**
 * Given a date in the form `dd/mm/yy`, `parseDateFromDaySlashMonthSlashYear()`
 * returns a `Date` object with the given day, month and year:
 *
 * > parseDateFromDaySlashMonthSlashYear('24/04/21').toISOString().slice(0,10)
 * '2021-04-24'
 */
function parseDateFromDaySlashMonthSlashYear(date) {
  const [day, month, year] = date
    .trim()
    .split('/')
    .map(Number);

  return new Date(2000+year, month-1, day);
}

/**
 * Given a date in the form `day / month` (being month the short name of a month
 * in Portuguese) and an year value, `parseDateFromDaySlashMonth()`returns a
 * `Date` object with the given day, month and year:
 *
 * > parseDateFromDaySlashMonth('24 / abr', 2023).toISOString().slice(0,10)
 * '2023-04-24'
 */
function parseDateFromDaySlashMonth(dayMonth, year) {
  const [month, day] = parseDateComponentsFromDaySlashMonth(dayMonth);

  return new Date(year, month-1, day);
}

/**
 * Given a date in the form `day / month` (being month the short name of a month
 * in Portuguese) and an year value, `getDateComponetsFromDaySlashMonth()`
 * returns an array with the day and month values, as integer numbers, starting
 * from 1:
 *
 * > parseDateComponentsFromDaySlashMonth('23 / abr')
 * [4, 23]
 */
function parseDateComponentsFromDaySlashMonth(dayMonth) {
  const [dayPart, monthPart] = dayMonth
    .split('/')
    .map(s => s.trim());
  const day = parseInt(dayPart);
  const month = parseMonthNumberToAbbreviatedMonthName(monthPart);

  return [month, day];
}


/**
 * Returns the numeric value of a month, given its shortened name:
 *
 * > parseMonthNumberToAbbreviatedMonthName('jan')
 * 1
 * > parseMonthNumberToAbbreviatedMonthName('abr')
 * 4
 * > parseMonthNumberToAbbreviatedMonthName('dez')
 * 12
 *
 * Note it is supposed to work with names in Portuguese:
 *
 * > parseMonthNumberToAbbreviatedMonthName('fev')
 * 2
 * > parseMonthNumberToAbbreviatedMonthName('mai')
 * 5
 */
function parseMonthNumberToAbbreviatedMonthName(monthName) {
  return [
    'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez'
  ].indexOf(monthName) + 1;
}

/**
 * Given a string with a number representation where the decimal separator is
 * a comma, `parseFloatFromDecimalCommaString()` returns the corresponding
 * number:
 *
 * > parseFloatFromDecimalCommaString('58,14')
 * 58.14
 * > parseFloatFromDecimalCommaString('-\n                            R$\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\n                            -10.823,97\n                            10.823,97')
 * -10823.97
 */
function parseFloatFromDecimalCommaString(number) {
  return parseFloat(
    extractDecimalCommaString(number)
  );
}


/**
 * Extracts a substring that matches a decimal-comman number:
 *
 * > extractDecimalCommaString('58,14')
 * '58.14'
 * > extractDecimalCommaString('                            R$\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\n                            -10.823,97\n')
 * '-10823.97'
 */
function extractDecimalCommaString(text) {
  const [number] = text.match('(-?[0-9.]+,[0-90]{2})') ?? [];
  return number
    ?.replace(/\./g, '')
    .replace(/,/, '.');
}

/**
 * `onlyFirstOccurence` is used to filter repeated values from an array. It is
 * supposed to be passed as an argument to `filter()`.
 *
 * If it is called with a given value, an index and an array, it verifies if
 * the given value of the index is the same as the index of the first occurence:
 *
 * > const object1 = {a:1}, object2 = {b:2}, array = [object1, object2, object1];
 * //
 * > firstOccurence(object1, 0, array)
 * true
 * > firstOccurence(object1, 2, array)
 * false
 *
 * Passing it to filter will result in unique values:
 *
 * > array.filter(firstOccurence)
 * [{a: 1}, {b: 2}]
 */
function firstOccurence(value, index, array) {
  return array.indexOf(value) === index;
}
