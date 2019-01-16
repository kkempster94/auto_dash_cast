/*
IN ORDER FOR THIS CODE TO RUN, YOU MUST COMMENT OUT 3 LINES OF CODE:
puppeteer/lib/launcher:36 '--disable-background-networking'
puppeteer/lib/launcher:40 '--disable-default-apps'
puppeteer/lib/launcher:42 '--disable-extensions'
*/

const puppeteer = require('puppeteer');

const yargs = require('yargs');

const hijackedCastCode = require('./hijacked_cast_code').code;

const url = yargs.default('url', 'analytics.spyfu.com').argv.url;

const reload = yargs.default('reload', false).argv.reload;

const reloadDelay = `${yargs.default('delay', 600).argv.delay}`;

const device = yargs.default('device', 'product lounge 2').argv.device;

const chromePath = yargs.default('chromePath', "C://Program Files (x86)/Google/Chrome/Application/chrome.exe").argv.chromePath;

const waitSeconds = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

const LIST_ELEMENTS_STRING = "const listElements = Array.from(document.querySelector('media-router-container').shadowRoot.querySelectorAll('#sink-list-view .sink-name'));";

function clickAppropriateListElement (deviceName) {
    return `listElements.find(elem => elem.innerHTML.replace(/\\n/g, '').trim().toLowerCase() === '${deviceName}').click();`;
}

async function getDevtoolsPageForTarget (target) {
    const wsEndpoint = target._browserContext._connection._url;
    const pageId = target._targetId;

    // use the host:port that Chromium provided, but replace the browser endpoint with the page to inspect
    const pageTargeUrl = `${wsEndpoint.replace('ws://', '').match(/.*(?=\/browser)/)[0]}/page/${pageId}`;
                
    // generate the full debugging url for the page I want to inspect
    const pageDebuggingUrl = `chrome-devtools://devtools/bundled/devtools_app.html?ws=${pageTargeUrl}`;
 
    const devtoolsPage = await browser.newPage();
    await devtoolsPage.goto(pageDebuggingUrl);

    await devtoolsPage.waitForSelector('.insertion-point-main');

    return devtoolsPage;
}

async function enterCodeIntoCodeMirrorElement (devtoolsPage, deviceToCastTo) {
    await devtoolsPage.waitForSelector('textarea[aria-label="Code editor"]');

    await devtoolsPage.type('textarea[aria-label="Code editor"]', LIST_ELEMENTS_STRING);

    await devtoolsPage.keyboard.press('Enter');

    await devtoolsPage.type('textarea[aria-label="Code editor"]', clickAppropriateListElement(deviceToCastTo));

    await devtoolsPage.keyboard.press('Enter');
}

(async () => {
    browser = await puppeteer.launch({
        args: [],
        executablePath: chromePath,
        // executablePath: "C://Program Files (x86)/Google/Chrome Beta/Application/chrome.exe",
        headless: false,
        // devtools: true
    });

    const page = (await browser.pages())[0]; 

    await page.goto('https://stestagg.github.io/dashcast/');
    await page.evaluate((script) => eval(script), hijackedCastCode);
    await page.type('input.url', url);
    if (reload) {
        await page.click('#reload.slider');

         // clear the input
        await page.click('input#reload-time', {clickCount: 3});
        await page.type('input#reload-time', reloadDelay);
    }

    await page.click('#go-button');
    let targets = await browser.targets();
    let target = targets.find(target => target._targetInfo.type === 'other');

    let devtoolsPage = await getDevtoolsPageForTarget(target);

    await waitSeconds(1);

    await devtoolsPage.keyboard.press('Escape');

    await waitSeconds(1);

    await enterCodeIntoCodeMirrorElement(devtoolsPage, device);

    try {
        await devtoolsPage.type('textarea[aria-label="Code editor"]', `document.querySelector('media-router-container').shadowRoot.querySelector('route-details').shadowRoot.querySelector('paper-button#start-casting-to-route-button').click();`);
        await devtoolsPage.keyboard.press('Enter');
    } catch (error) { }

    await waitSeconds(5);
    
    await browser.close();
})();