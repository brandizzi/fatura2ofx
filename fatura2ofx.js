// ==UserScript==
// @name     Fatura 2 OFX
// @version  1
// @grant    none
// ==/UserScript==

////////////////////////////////////////////////////////////////////////////////
// EXTRACTION FUNCTIONS
//
// These operations are responsible to take data from the HTML from the Itaú
// site into an object.
////////////////////////////////////////////////////////////////////////////////

/**
 * `getOFXData()` returns an object with all relevant infromation to build an
 * OFX file. It expects to receive a DOM object:
 *
 * > const fs = require('fs');
 * . const {JSDOM} = require('jsdom');
 * . const html = fs.readFileSync('pagina-fatura-exemplo.html', 'utf-8');
 * . const document = new JSDOM(html).window.document;
 * . const ofxData = getOFXData(document);
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
 *    3
 */
function getOFXData(html) {
  return {
    DTSERVER: new Date(),
    BANKTRANLIST: getBankTranList(html),
    dueDate: getDueDate(html),
  };
}

/**
 * `getDueDate()` extracts the due date from the DOM object:
 *
 * > getDueDate(document).toISOString().slice(0,10)
 * '2020-07-15'
 */
function getDueDate(html) {
  const extractedDate = html
    .getElementsByClassName('c-category-status__venc')[0]
    .getElementsByClassName('c-category-status__value')[0]
    .textContent;

  return parseDateFromDaySlashMonthSlashYear(extractedDate);
}

/**
 * `getBankTranList()` returns a list of transactions from the page:
 *
 * > const transactionList = getBankTranList(document);
 * //
 * > transactionList.length
 * 3
 *
 * Each object should have the value of the transaction:
 *
 * > transactionList[0].TRNAMT
 * -10823.97
 *
 */
function getBankTranList(html) {
  const transactionNodes = getTransactionNodes(html);

  const bankTranList = [...transactionNodes]
    .map(getStmtTrnFromNode);

  return bankTranList;
}

/**
 * In the bank page, every transactions comes inside a `<table>` element.
 * `getTransactionNodes()` will return every one of these elements:
 *
 * > const nodes = getTransactionNodes(document);
 * //
 * > nodes.length
 * 3
 * > nodes.map(e => e.tagName)
 * ['TABLE', 'TABLE', 'TABLE']
 *
 * These should also have at least one of the table cells with the expected
 * values: date, description and value:
 *
 * > nodes.map(e => !!e.getElementsByClassName('fatura__table-col-data'))
 * [true, true, true]
 * > nodes.map(e => !!e.getElementsByClassName('fatura__table-col-desc'))
 * [true, true, true]
 * > nodes.map(e => !!e.getElementsByClassName('fatura__table-col-num'))
 * [true, true, true]
 */
function getTransactionNodes(html) {
  const dateNodes = html
    .getElementsByClassName('fatura__table-col-data');

  const transactionNodes = [...dateNodes]
    .map(e => e.closest('table'))
    .filter(firstOccurence);

  return transactionNodes;
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

/**
 * `getStmtTrnFromNode` converts a `table` node with all necessary elements
 * into an STMTTRN object:
 *
 * > const stmtTrn = getStmtTrnFromNode(
 * .   document.getElementsByClassName('FATURA2OFX_TEST_EXPENSE1')[0])
 * //
 * > stmtTrn.TRNAMT
 * 58.14
 * > stmtTrn.DTPOSTED.toISOString().slice(0,10)
 * '2020-04-23'
 * > stmtTrn.MEMO
 * 'Amazon Br         03/04'
 */
function getStmtTrnFromNode(node) {
  const TRNAMT = parseFloat(
      [
        ...node
          .querySelectorAll('.fatura__table-col-num span:not([aria-hidden="true"])')
      ].map(e => extractDecimalCommaString(e.textContent))
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
    2023,
  );

  return {
    DTPOSTED,
    MEMO,
    TRNAMT,
  };
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
  const month = convertMonthNumberToAbbreviatedMonthName(monthPart);

  return [month, day];
}


/**
 * Returns the numeric value of a month, given its shortened name:
 *
 * > convertMonthNumberToAbbreviatedMonthName('jan')
 * 1
 * > convertMonthNumberToAbbreviatedMonthName('abr')
 * 4
 * > convertMonthNumberToAbbreviatedMonthName('dez')
 * 12
 *
 * Note it is supposed to work with names in Portuguese:
 *
 * > convertMonthNumberToAbbreviatedMonthName('fev')
 * 2
 * > convertMonthNumberToAbbreviatedMonthName('mai')
 * 5
 */
function convertMonthNumberToAbbreviatedMonthName(monthName) {
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
