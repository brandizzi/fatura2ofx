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
 * . const ofxData = getOFXData(fs.readFileSync('pagina-fatura-exemplo.html'));
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
 */
function getOFXData(html) {
  return {
    DTSERVER: new Date(),
  };
}
