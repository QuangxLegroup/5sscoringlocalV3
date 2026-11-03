const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('Theme Switcher & Light/Dark Mode Implementation', async (t) => {
  await t.test('index.html contains theme script and dropdown theme switcher', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    assert.match(html, /localStorage\.getItem\(["']app_theme["']\)/, 'index.html has early theme detection script');
    assert.match(html, /class="account-menu-theme-row"/, 'index.html account menu contains theme switcher row');
    assert.match(html, /data-theme-set="light"/, 'has light theme button');
    assert.match(html, /data-theme-set="dark"/, 'has dark theme button');
  });

  await t.test('admin-home-page.js contains theme switcher in cyberAccountMenu and guide card', () => {
    const js = fs.readFileSync('modules/pages/admin-home-page.js', 'utf8');
    assert.match(js, /class="account-menu-theme-row"/, 'admin-home-page.js cyberAccountMenu contains theme switcher row');
    assert.match(js, /data-theme-set="light"/, 'has light theme button');
    assert.match(js, /data-theme-set="dark"/, 'has dark theme button');
    assert.match(js, /cyber-home-guide-card/, 'has cyber-home-guide-card matching Image 2');
  });

  await t.test('app.js exposes getAppTheme and setAppTheme and binds theme toggle buttons', () => {
    const js = fs.readFileSync('app.js', 'utf8');
    assert.match(js, /function getAppTheme\(\)/, 'app.js defines getAppTheme');
    assert.match(js, /function setAppTheme\(theme\)/, 'app.js defines setAppTheme');
    assert.match(js, /window\.getAppTheme\s*=\s*getAppTheme/, 'window.getAppTheme exposed');
    assert.match(js, /window\.setAppTheme\s*=\s*setAppTheme/, 'window.setAppTheme exposed');
    assert.match(js, /\[data-theme-set\]/, 'app.js delegates clicks on [data-theme-set]');
  });

  await t.test('styles.css contains dark dropdown and light mode with anhnhamay.jpg background', () => {
    const css = fs.readFileSync('styles.css', 'utf8');
    assert.match(css, /anhnhamay\.jpg/, 'styles.css references images/anhnhamay.jpg for light mode background');
    assert.match(css, /\[data-theme="dark"\]\s*\.account-menu/, 'styles.css styles dark mode account dropdown');
    assert.match(css, /\[data-theme="light"\]\s*\.account-menu/, 'styles.css styles light mode account dropdown');
    assert.match(css, /\.account-menu-theme-row/, 'styles.css styles theme switcher row');
    assert.match(css, /\.theme-toggle-btn\.is-active/, 'styles.css styles active theme button');
  });

  await t.test('service-worker.js caches images/anhnhamay.jpg', () => {
    const sw = fs.readFileSync('service-worker.js', 'utf8');
    assert.match(sw, /\/images\/anhnhamay\.jpg/, 'service-worker caches anhnhamay.jpg');
  });
});
