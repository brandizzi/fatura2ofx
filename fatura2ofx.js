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
 *    '2024-07-15'
 *
 */
function getOFXData(html) {
  return {
    DTSERVER: new Date(),
    dueDate: getDueDate(html),
  };
}

/**
 * `getDueDate()` extracts the due date from the DOM object:
 *
 * > getDueDate(document).toISOString().slice(0,10)
 * '2024-07-15'
 */
function getDueDate(html) {
  const extractedDate = html
    .getElementsByClassName('c-category-status__venc')[0]
    .getElementsByClassName('c-category-status__value')[0]
    .textContent;
  const [day, month, year] = extractedDate
    .trim()
    .split('/')
    .map(Number);

  return new Date(2000+year, month-1, day);
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
