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
