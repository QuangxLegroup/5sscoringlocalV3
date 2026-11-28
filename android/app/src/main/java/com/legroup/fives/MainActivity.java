package com.legroup.fives;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.Parcelable;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.text.TextUtils;
import android.util.Base64;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {

    private static final long INITIAL_LOAD_TIMEOUT_MS = 10000L;

    private static final String OFFLINE_FA_FALLBACK_CSS =
            ".fa-solid,.fa-regular,.fas,.far{font-style:normal;font-weight:700;display:inline-flex;align-items:center;justify-content:center;line-height:1;}" +
            ".fa-xmark::before{content:'\\00D7';}" +
            ".fa-plus::before{content:'+';}" +
            ".fa-camera::before{content:'\\1F4F7';font-weight:400;}" +
            ".fa-image::before{content:'\\1F5BC';font-weight:400;}" +
            ".fa-trash-can::before{content:'\\1F5D1';font-weight:400;}" +
            ".fa-pen-to-square::before{content:'\\270E';}" +
            ".fa-chevron-down::before{content:'\\25BE';}" +
            ".fa-chevron-right::before{content:'\\25B8';}" +
            ".fa-circle-check::before{content:'\\2713';}" +
            ".fa-circle-exclamation::before,.fa-triangle-exclamation::before{content:'!';}" +
            ".fa-circle-question::before{content:'?';}" +
            ".fa-arrows-rotate::before{content:'\\21BB';}" +
            ".fa-floppy-disk::before{content:'\\1F4BE';font-weight:400;}" +
            ".fa-lock::before{content:'\\1F512';font-weight:400;}" +
            ".fa-eye::before{content:'\\1F441';font-weight:400;}" +
            ".fa-bell::before{content:'\\1F514';font-weight:400;}" +
            ".fa-sun::before{content:'\\2600';}" +
            ".fa-moon::before{content:'\\263E';}" +
            ".fa-paper-plane::before{content:'\\27A4';}" +
            ".fa-arrow-right-from-bracket::before{content:'\\21B3';}" +
            ".fa-calendar-days::before,.fa-calendar-check::before{content:'\\1F4C5';font-weight:400;}" +
            ".fa-clock::before,.fa-clock-rotate-left::before{content:'\\23F0';font-weight:400;}" +
            ".fa-clipboard-check::before{content:'\\1F4CB';font-weight:400;}" +
            ".fa-shield-check::before{content:'\\1F6E1';font-weight:400;}" +
            ".fa-file-excel::before{content:'\\1F4C4';font-weight:400;}" +
            ".fa-wrench::before,.fa-sliders::before{content:'\\2699';}" +
            ".fa-spinner::before{content:'\\21BB';}" +
            ".fa-expand::before{content:'\\26F6';}" +
            ".fa-envelope::before{content:'\\2709';}" +
            ".fa-user-check::before,.fa-user-gear::before,.fa-user-plus::before,.fa-user-shield::before{content:'\\1F464';font-weight:400;}" +
            ".fa-book-open::before{content:'\\1F4D6';font-weight:400;}" +
            ".fa-circle-half-stroke::before{content:'\\25D0';font-weight:400;}" +
            ".fa-folder-tree::before{content:'\\1F4C2';font-weight:400;}" +
            ".fa-tv::before{content:'\\1F4FA';font-weight:400;}" +
            ".fa-mobile-screen-button::before{content:'\\1F4F1';font-weight:400;}";

    private View rootContainer;
    private WebView webView;
    private ProgressBar topProgressBar;
    private View splashOverlay;
    private View errorOverlay;
    private TextView errorDetailText;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();
    private Runnable loadTimeoutRunnable;

    private boolean mainFrameFailed = false;
    private boolean firstLoadComplete = false;
    private volatile String currentLoadedUrl = "";
    private long lastBackPressMs = 0L;

    private ValueCallback<Uri[]> pendingFileCallback;
    private WebChromeClient.FileChooserParams pendingChooserParams;
    private Uri pendingCameraOutputUri;
    private File pendingCameraOutputFile;

    private ActivityResultLauncher<String> cameraPermissionLauncher;
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        rootContainer = findViewById(R.id.rootContainer);
        webView = findViewById(R.id.webView);
        topProgressBar = findViewById(R.id.topProgressBar);
        splashOverlay = findViewById(R.id.splashOverlay);
        errorOverlay = findViewById(R.id.errorOverlay);
        errorDetailText = findViewById(R.id.errorDetailText);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(false);
            insetsController.setAppearanceLightNavigationBars(false);
        }

        ViewCompat.setOnApplyWindowInsetsListener(rootContainer, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime()
            );
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        Button btnRetry = findViewById(R.id.btnRetry);
        btnRetry.setOnClickListener(v -> loadServer());

        registerActivityResultLaunchers();
        configureWebView();
        registerBackHandler();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
            firstLoadComplete = true;
            splashOverlay.setVisibility(View.GONE);
        } else {
            loadServer();
        }
    }

    private void registerActivityResultLaunchers() {
        cameraPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(),
                granted -> launchFileChooser(Boolean.TRUE.equals(granted))
        );

        fileChooserLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    Uri[] uris = null;
                    if (result.getResultCode() == Activity.RESULT_OK) {
                        Intent data = result.getData();
                        if (data != null && data.getClipData() != null) {
                            ClipData clipData = data.getClipData();
                            int count = clipData.getItemCount();
                            List<Uri> picked = new ArrayList<>();
                            for (int i = 0; i < count; i++) {
                                Uri itemUri = clipData.getItemAt(i).getUri();
                                if (itemUri != null) picked.add(itemUri);
                            }
                            if (!picked.isEmpty()) {
                                uris = picked.toArray(new Uri[0]);
                            }
                        } else if (data != null && data.getData() != null) {
                            uris = new Uri[]{data.getData()};
                        } else if (pendingCameraOutputUri != null
                                && pendingCameraOutputFile != null
                                && pendingCameraOutputFile.exists()
                                && pendingCameraOutputFile.length() > 0) {
                            uris = new Uri[]{pendingCameraOutputUri};
                        }
                    }
                    finishFileCallback(uris);
                }
        );
    }

    private void finishFileCallback(Uri[] result) {
        if (pendingFileCallback != null) {
            try {
                pendingFileCallback.onReceiveValue(result);
            } catch (Exception ignored) {
            }
        }
        pendingFileCallback = null;
        pendingChooserParams = null;
        pendingCameraOutputUri = null;
        pendingCameraOutputFile = null;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setUserAgentString(settings.getUserAgentString() + " LeGroup5SAndroid/" + BuildConfig.VERSION_NAME);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);
        webView.setNetworkAvailable(true);

        webView.addJavascriptInterface(new AndroidBridge(), "LeGroupAndroid");

        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            if (TextUtils.isEmpty(url)) return;
            String fileName = URLUtil.guessFileName(url, contentDisposition, mimetype);
            if (url.startsWith("blob:")) {
                String safeName = escapeJsString(fileName);
                String safeMime = escapeJsString(mimetype != null ? mimetype : "application/octet-stream");
                webView.evaluateJavascript(
                        "(function(){fetch('" + escapeJsString(url) + "').then(function(r){return r.blob();}).then(function(b){" +
                                "var fr=new FileReader();fr.onloadend=function(){var res=String(fr.result||'');var idx=res.indexOf(',');" +
                                "if(idx>=0&&window.LeGroupAndroid){window.LeGroupAndroid.saveBase64File('" + safeName + "',b.type||'" + safeMime + "',res.slice(idx+1));}};" +
                                "fr.readAsDataURL(b);}).catch(function(){});})();",
                        null
                );
                return;
            }
            if (url.startsWith("http://") || url.startsWith("https://")) {
                downloadHttpFile(url, fileName, mimetype);
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Nullable
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    String url = request.getUrl().toString();
                    // On offline internal LAN Wi-Fi, external CDN links (Google Fonts, FontAwesome)
                    // hang for 30-60s waiting for TCP timeout. Short-circuit external hosts instantly!
                    if ((url.startsWith("http://") || url.startsWith("https://")) && !isSameServerOrigin(url)) {
                        if (url.contains("font-awesome") && url.contains(".css")) {
                            byte[] cssBytes = OFFLINE_FA_FALLBACK_CSS.getBytes(StandardCharsets.UTF_8);
                            return new WebResourceResponse("text/css", "UTF-8", new ByteArrayInputStream(cssBytes));
                        }
                        String mime = url.contains(".css") || url.contains("fonts.googleapis.com")
                                ? "text/css"
                                : "text/plain";
                        return new WebResourceResponse(mime, "UTF-8", new ByteArrayInputStream(new byte[0]));
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return false;
                String url = uri.toString();
                if (isSameServerOrigin(url)) {
                    return false;
                }
                if (url.startsWith("mailto:") || url.startsWith("tel:")) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (ActivityNotFoundException ignored) {
                    }
                    return true;
                }
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                currentLoadedUrl = url != null ? url : "";
                mainFrameFailed = false;
                topProgressBar.setVisibility(View.VISIBLE);
                topProgressBar.setProgress(15);
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                super.onPageCommitVisible(view, url);
                if (!mainFrameFailed && url != null && !url.equals("about:blank")) {
                    cancelLoadTimeout();
                    markLoadedAndShowWebView();
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                currentLoadedUrl = url != null ? url : "";
                CookieManager.getInstance().flush();
                cancelLoadTimeout();
                topProgressBar.setVisibility(View.GONE);
                if (!mainFrameFailed && url != null && !url.equals("about:blank")) {
                    markLoadedAndShowWebView();
                    if (isSameServerOrigin(url)) {
                        injectAndroidBridgeHelpers(view);
                    }
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request != null && request.isForMainFrame()) {
                    mainFrameFailed = true;
                    cancelLoadTimeout();
                    showErrorOverlay();
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                super.onReceivedHttpError(view, request, errorResponse);
                if (request != null && request.isForMainFrame() && errorResponse != null && errorResponse.getStatusCode() >= 500) {
                    mainFrameFailed = true;
                    cancelLoadTimeout();
                    showErrorOverlay();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress >= 100) {
                    topProgressBar.setVisibility(View.GONE);
                } else {
                    topProgressBar.setVisibility(View.VISIBLE);
                    topProgressBar.setProgress(newProgress);
                }
                if (newProgress >= 80 && !mainFrameFailed && !firstLoadComplete) {
                    cancelLoadTimeout();
                    markLoadedAndShowWebView();
                }
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (pendingFileCallback != null) {
                    finishFileCallback(null);
                }
                pendingFileCallback = filePathCallback;
                pendingChooserParams = fileChooserParams;

                boolean wantsImage = wantsImagePicker(fileChooserParams);
                if (wantsImage && ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                        != PackageManager.PERMISSION_GRANTED) {
                    cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
                    return true;
                }

                launchFileChooser(wantsImage && ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                        == PackageManager.PERMISSION_GRANTED);
                return true;
            }
        });
    }

    private void markLoadedAndShowWebView() {
        firstLoadComplete = true;
        splashOverlay.setVisibility(View.GONE);
        errorOverlay.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
    }

    private void scheduleLoadTimeout() {
        cancelLoadTimeout();
        loadTimeoutRunnable = () -> {
            if (!firstLoadComplete && !mainFrameFailed) {
                mainFrameFailed = true;
                webView.stopLoading();
                showErrorOverlay();
            }
        };
        mainHandler.postDelayed(loadTimeoutRunnable, INITIAL_LOAD_TIMEOUT_MS);
    }

    private void cancelLoadTimeout() {
        if (loadTimeoutRunnable != null) {
            mainHandler.removeCallbacks(loadTimeoutRunnable);
            loadTimeoutRunnable = null;
        }
    }

    private boolean wantsImagePicker(WebChromeClient.FileChooserParams params) {
        if (params == null) return true;
        String[] types = params.getAcceptTypes();
        if (types == null || types.length == 0) return true;
        for (String type : types) {
            if (TextUtils.isEmpty(type) || type.contains("image") || type.equals("*/*")) {
                return true;
            }
        }
        return false;
    }

    private void launchFileChooser(boolean allowCamera) {
        if (pendingFileCallback == null) return;

        boolean wantsImage = wantsImagePicker(pendingChooserParams);
        boolean allowMultiple = pendingChooserParams != null
                && pendingChooserParams.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE;

        Intent contentIntent = new Intent(Intent.ACTION_GET_CONTENT);
        contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
        contentIntent.setType(wantsImage ? "image/*" : "*/*");
        if (allowMultiple) {
            contentIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }

        List<Intent> extraIntents = new ArrayList<>();
        pendingCameraOutputUri = null;
        pendingCameraOutputFile = null;

        if (allowCamera && wantsImage) {
            try {
                File photoDir = new File(getCacheDir(), "camera_photos");
                if (!photoDir.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    photoDir.mkdirs();
                }
                String stamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
                File photoFile = File.createTempFile("LEG5S_" + stamp + "_", ".jpg", photoDir);
                Uri photoUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", photoFile);

                Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoUri);
                cameraIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);

                pendingCameraOutputFile = photoFile;
                pendingCameraOutputUri = photoUri;
                extraIntents.add(cameraIntent);
            } catch (Exception ignored) {
                pendingCameraOutputFile = null;
                pendingCameraOutputUri = null;
            }
        }

        Intent chooser = Intent.createChooser(contentIntent, getString(R.string.chooser_title));
        if (!extraIntents.isEmpty()) {
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, extraIntents.toArray(new Parcelable[0]));
        }

        try {
            fileChooserLauncher.launch(chooser);
        } catch (ActivityNotFoundException e) {
            finishFileCallback(null);
            Toast.makeText(this, "Không tìm thấy ứng dụng Camera hoặc Thư viện ảnh.", Toast.LENGTH_LONG).show();
        }
    }

    private void injectAndroidBridgeHelpers(WebView view) {
        String js = "(function(){" +
                "if(window.__LEGROUP_ANDROID_BRIDGE_READY__){return;}" +
                "window.__LEGROUP_ANDROID_BRIDGE_READY__=true;" +
                "var blobMap=new Map();" +
                "var origCreate=URL.createObjectURL.bind(URL);" +
                "var origRevoke=URL.revokeObjectURL.bind(URL);" +
                "URL.createObjectURL=function(obj){" +
                "  var u=origCreate(obj);" +
                "  try{if(obj instanceof Blob){blobMap.set(u,obj);setTimeout(function(){blobMap.delete(u);},60000);}}catch(e){}" +
                "  return u;" +
                "};" +
                "URL.revokeObjectURL=function(u){" +
                "  setTimeout(function(){try{origRevoke(u);}catch(e){} blobMap.delete(u);},15000);" +
                "};" +
                "function sendBlobToAndroid(blob,filename){" +
                "  if(!blob||!window.LeGroupAndroid){return;}" +
                "  var fr=new FileReader();" +
                "  fr.onloadend=function(){" +
                "    var res=String(fr.result||'');" +
                "    var idx=res.indexOf(',');" +
                "    if(idx>=0){window.LeGroupAndroid.saveBase64File(filename||'export-5s',blob.type||'application/octet-stream',res.slice(idx+1));}" +
                "  };" +
                "  fr.readAsDataURL(blob);" +
                "}" +
                "var origAnchorClick=HTMLAnchorElement.prototype.click;" +
                "HTMLAnchorElement.prototype.click=function(){" +
                "  try{" +
                "    var href=this.getAttribute('href')||this.href||'';" +
                "    if(href.indexOf('blob:')===0&&this.hasAttribute('download')){" +
                "      var fname=this.getAttribute('download')||'legroup-5s-export';" +
                "      var cached=blobMap.get(href);" +
                "      if(cached){sendBlobToAndroid(cached,fname);return;}" +
                "      fetch(href).then(function(r){return r.blob();}).then(function(b){sendBlobToAndroid(b,fname);}).catch(function(){});" +
                "      return;" +
                "    }" +
                "  }catch(e){}" +
                "  return origAnchorClick.apply(this,arguments);" +
                "};" +
                "document.addEventListener('click',function(ev){" +
                "  var a=ev.target&&ev.target.closest?ev.target.closest('a[download]'):null;" +
                "  if(!a){return;}" +
                "  var href=a.getAttribute('href')||a.href||'';" +
                "  if(href.indexOf('blob:')===0){" +
                "    ev.preventDefault();" +
                "    var fname=a.getAttribute('download')||'legroup-5s-export';" +
                "    var cached=blobMap.get(href);" +
                "    if(cached){sendBlobToAndroid(cached,fname);}" +
                "    else{fetch(href).then(function(r){return r.blob();}).then(function(b){sendBlobToAndroid(b,fname);}).catch(function(){});}" +
                "  }" +
                "},true);" +
                "window.print=function(){" +
                "  if(window.LeGroupAndroid){window.LeGroupAndroid.printCurrentPage(document.title||'LeGroup 5S');}" +
                "};" +
                "document.querySelectorAll('[data-apk-download],#apk-download-section').forEach(function(el){el.style.display='none';});" +
                "})();";
        view.evaluateJavascript(js, null);
    }

    private void registerBackHandler() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (errorOverlay.getVisibility() == View.VISIBLE) {
                    handleExitDoubleTap();
                    return;
                }
                webView.evaluateJavascript(
                        "(function(){" +
                                "var imgModal=document.getElementById('mobileImageModal');" +
                                "if(imgModal){imgModal.remove();return 'closed';}" +
                                "var backdrop=document.getElementById('modal-backdrop');" +
                                "if(backdrop&&!backdrop.hidden){var c=document.getElementById('modal-close-button');if(c){c.click();return 'closed';}}" +
                                "var openDialog=document.querySelector('dialog[open]');" +
                                "if(openDialog){try{openDialog.close();}catch(e){openDialog.remove();}return 'closed';}" +
                                "return 'none';" +
                                "})();",
                        result -> {
                            if (result != null && result.contains("closed")) {
                                return;
                            }
                            if (webView.canGoBack()) {
                                webView.goBack();
                            } else {
                                handleExitDoubleTap();
                            }
                        }
                );
            }
        });
    }

    private void handleExitDoubleTap() {
        long now = System.currentTimeMillis();
        if (now - lastBackPressMs < 2000L) {
            finish();
        } else {
            lastBackPressMs = now;
            Toast.makeText(this, R.string.press_back_again, Toast.LENGTH_SHORT).show();
        }
    }

    private void loadServer() {
        String serverUrl = getConfiguredServerUrl();
        mainFrameFailed = false;
        firstLoadComplete = false;
        errorOverlay.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        splashOverlay.setVisibility(View.VISIBLE);
        scheduleLoadTimeout();
        webView.loadUrl(serverUrl);
    }

    private void showErrorOverlay() {
        mainHandler.post(() -> {
            firstLoadComplete = true;
            splashOverlay.setVisibility(View.GONE);
            topProgressBar.setVisibility(View.GONE);
            errorDetailText.setText(R.string.error_hint);
            errorOverlay.setVisibility(View.VISIBLE);
            webView.setVisibility(View.INVISIBLE);
        });
    }

    private String getConfiguredServerUrl() {
        String normalized = normalizeServerUrl(BuildConfig.DEFAULT_SERVER_URL);
        return normalized != null ? normalized : "http://192.168.1.103:5500";
    }

    private String normalizeServerUrl(String raw) {
        if (raw == null) return null;
        String value = raw.trim();
        if (value.isEmpty()) return null;
        if (!value.startsWith("http://") && !value.startsWith("https://")) {
            value = "http://" + value;
        }
        while (value.endsWith("/")) {
            value = value.substring(0, value.length() - 1);
        }
        try {
            URI uri = URI.create(value);
            if (TextUtils.isEmpty(uri.getHost())) return null;
            String scheme = uri.getScheme();
            if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) return null;
            return value;
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isSameServerOrigin(String url) {
        if (TextUtils.isEmpty(url)) return false;
        try {
            URI target = URI.create(url);
            URI configured = URI.create(getConfiguredServerUrl());
            if (target.getHost() == null || configured.getHost() == null) return false;
            int targetPort = target.getPort() != -1 ? target.getPort() : ("https".equalsIgnoreCase(target.getScheme()) ? 443 : 80);
            int configPort = configured.getPort() != -1 ? configured.getPort() : ("https".equalsIgnoreCase(configured.getScheme()) ? 443 : 80);
            return configured.getHost().equalsIgnoreCase(target.getHost())
                    && configPort == targetPort
                    && configured.getScheme().equalsIgnoreCase(target.getScheme());
        } catch (Exception e) {
            return false;
        }
    }

    private void downloadHttpFile(String fileUrl, String fileName, String mimeType) {
        ioExecutor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(fileUrl);
                conn = (HttpURLConnection) url.openConnection();
                String cookies = CookieManager.getInstance().getCookie(fileUrl);
                if (!TextUtils.isEmpty(cookies)) {
                    conn.setRequestProperty("Cookie", cookies);
                }
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                if (conn.getResponseCode() >= 200 && conn.getResponseCode() < 300) {
                    byte[] bytes;
                    try (InputStream in = conn.getInputStream();
                         ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                        byte[] chunk = new byte[8192];
                        int read;
                        while ((read = in.read(chunk)) != -1) {
                            buffer.write(chunk, 0, read);
                        }
                        bytes = buffer.toByteArray();
                    }
                    String resolvedMime = !TextUtils.isEmpty(mimeType) ? mimeType : conn.getContentType();
                    saveBytesToDownloads(fileName, resolvedMime, bytes);
                } else {
                    showToastOnMain("Không tải được tệp (HTTP " + conn.getResponseCode() + ").");
                }
            } catch (Exception e) {
                showToastOnMain("Lỗi tải tệp: " + (e.getMessage() != null ? e.getMessage() : "Không xác định"));
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    private void saveBytesToDownloads(String rawFileName, String rawMimeType, byte[] data) {
        String safeName = sanitizeFileName(rawFileName);
        String mimeType = resolveMimeType(safeName, rawMimeType);

        try {
            Uri savedUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                savedUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (savedUri == null) throw new IOException("Không tạo được tệp trong Tải xuống.");
                try (OutputStream out = resolver.openOutputStream(savedUri)) {
                    if (out == null) throw new IOException("Không mở được luồng ghi tệp.");
                    out.write(data);
                    out.flush();
                }
            } else {
                File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) dir = new File(getFilesDir(), "downloads");
                if (!dir.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    dir.mkdirs();
                }
                File outFile = new File(dir, safeName);
                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                    fos.write(data);
                    fos.flush();
                }
                savedUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", outFile);
            }

            final Uri finalUri = savedUri;
            mainHandler.post(() -> {
                Toast.makeText(this, "Đã lưu vào Thư mục Tải xuống: " + safeName, Toast.LENGTH_LONG).show();
                new AlertDialog.Builder(this)
                        .setTitle("Đã tải tệp thành công")
                        .setMessage("Tệp \"" + safeName + "\" đã được lưu vào thư mục Tải xuống (Downloads).")
                        .setPositiveButton("Mở tệp", (d, w) -> openDownloadedUri(finalUri, mimeType))
                        .setNegativeButton("Đóng", null)
                        .show();
            });
        } catch (Exception e) {
            showToastOnMain("Không lưu được tệp: " + (e.getMessage() != null ? e.getMessage() : "Lỗi hệ thống"));
        }
    }

    private void openDownloadedUri(Uri uri, String mimeType) {
        Intent viewIntent = new Intent(Intent.ACTION_VIEW);
        viewIntent.setDataAndType(uri, mimeType);
        viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(Intent.createChooser(viewIntent, "Mở tệp bằng"));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Không có ứng dụng phù hợp để mở tệp này trên điện thoại.", Toast.LENGTH_LONG).show();
        }
    }

    private String sanitizeFileName(String name) {
        String clean = TextUtils.isEmpty(name) ? "legroup-5s-export.xlsx" : name.trim();
        clean = clean.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_").replace("..", "_");
        if (clean.isEmpty()) clean = "legroup-5s-export.xlsx";
        return clean;
    }

    private String resolveMimeType(String fileName, String rawMime) {
        if (!TextUtils.isEmpty(rawMime) && !rawMime.equals("application/octet-stream")) {
            int semi = rawMime.indexOf(';');
            return semi > 0 ? rawMime.substring(0, semi).trim() : rawMime.trim();
        }
        String lower = fileName.toLowerCase(Locale.US);
        if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".json")) return "application/json";
        String ext = MimeTypeMap.getFileExtensionFromUrl(fileName);
        if (!TextUtils.isEmpty(ext)) {
            String detected = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase(Locale.US));
            if (!TextUtils.isEmpty(detected)) return detected;
        }
        return "application/octet-stream";
    }

    private String escapeJsString(String value) {
        if (value == null) return "";
        return value
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "");
    }

    private void showToastOnMain(String msg) {
        mainHandler.post(() -> Toast.makeText(this, msg, Toast.LENGTH_LONG).show());
    }

    private class AndroidBridge {
        private boolean isTrustedCaller() {
            return isSameServerOrigin(currentLoadedUrl);
        }

        @JavascriptInterface
        public String getAppVersion() {
            return BuildConfig.VERSION_NAME;
        }

        @JavascriptInterface
        public void saveBase64File(String filename, String mimeType, String base64Data) {
            if (!isTrustedCaller() || TextUtils.isEmpty(base64Data)) return;
            ioExecutor.execute(() -> {
                try {
                    byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                    saveBytesToDownloads(filename, mimeType, bytes);
                } catch (Exception e) {
                    showToastOnMain("Không giải mã được dữ liệu tệp tải xuống.");
                }
            });
        }

        @JavascriptInterface
        public void printCurrentPage(String jobTitle) {
            if (!isTrustedCaller()) return;
            mainHandler.post(() -> {
                PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) {
                    Toast.makeText(MainActivity.this, "Thiết bị không hỗ trợ in / xuất PDF.", Toast.LENGTH_SHORT).show();
                    return;
                }
                String title = TextUtils.isEmpty(jobTitle) ? "LeGroup 5S" : jobTitle;
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(title);
                printManager.print(title, adapter, new PrintAttributes.Builder().build());
            });
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.setNetworkAvailable(true);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onDestroy() {
        cancelLoadTimeout();
        finishFileCallback(null);
        ioExecutor.shutdownNow();
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
