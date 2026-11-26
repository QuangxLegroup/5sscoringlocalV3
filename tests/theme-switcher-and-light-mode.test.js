const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('Theme Switcher & Light/Dark Mode Implementation', async (t) => {
  await t.test('index.html contains theme script and dropdown theme switcher', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    assert.match(html, /localStorage\.getItem\(["']app_theme["']\)\s*\|\|\s*["']light["']/, 'index.html defaults to light theme');
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
    assert.match(js, /localStorage\.getItem\(["']app_theme["']\)\s*\|\|\s*["']light["']/, 'app.js defaults to light theme');
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

  await t.test('styles.css keeps dark theme cyber top nav free of light theme contamination', () => {
    const css = fs.readFileSync('styles.css', 'utf8');
    // Ensure home cyber top nav is not forced to light gradient
    assert.doesNotMatch(
      css,
      /body:has\(#tab-home\.is-active\)\s*\.cyber-top-nav\.app-header\s*\.header-quick-nav\s*\{[^}]*linear-gradient\(120deg/s,
      'Dark cyber top nav quick nav must not be given light theme gradient background'
    );
    // Ensure dark theme cyber top nav quick nav is explicitly styled with dark background
    assert.match(
      css,
      /\[data-theme="dark"\]\s*\.cyber-top-nav\s*\.header-quick-nav/,
      'Dark theme cyber top nav quick nav must have explicit dark styles'
    );
    // Ensure user name in dark header is white
    assert.match(
      css,
      /\.app-header\s*\.cyber-user-name[^}]*color:\s*#ffffff/s,
      'Username in app header must be white in dark mode'
    );
    // Ensure light theme quick nav text has high-contrast blue and active white pill with blue text
    assert.match(
      css,
      /\[data-theme="light"\]\s*\.cyber-top-nav\s*\.header-quick-nav\s*\.tab-button\s*span[^}]*color:\s*#123f83/s,
      'Light mode quick nav tab button span must have #123f83 blue text'
    );
    assert.match(
      css,
      /\[data-theme="light"\]\s*\.cyber-top-nav\s*\.header-quick-nav\s*\.tab-button\.active[^}]*background:\s*#ffffff[^}]*color:\s*#1d4ed8/s,
      'Light mode active quick nav button must have white capsule background and #1d4ed8 blue text'
    );
    // Ensure subpage header always stays in light glass palette and is never made dark
    assert.doesNotMatch(
      css,
      /\[data-theme="dark"\]\s*\.app-header\s*,\s*body\.theme-dark\s*\.app-header\s*\{[^}]*background:\s*rgba\(4,\s*10,\s*26/s,
      'Subpage app header must never be given dark background in dark mode'
    );
    // Ensure disabled controls default to clean light mode styling (#e8eef5)
    assert.match(
      css,
      /input:not\(\[type="checkbox"\]\)[^\{]*:disabled[^\{]*\{[^}]*background-color:\s*#e8eef5/s,
      'Disabled inputs and controls must default to light #e8eef5 styling'
    );
  });

  await t.test('service-worker.js caches images/anhnhamay.jpg', () => {
    const sw = fs.readFileSync('service-worker.js', 'utf8');
    assert.match(sw, /\/images\/anhnhamay\.jpg/, 'service-worker caches anhnhamay.jpg');
  });
});
