package com.sonycable.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Build;
import android.telephony.SmsManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(DirectSmsPlugin.class);
        super.onCreate(savedInstanceState);

        // Auto request SEND_SMS runtime permission if not already granted
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.SEND_SMS}, 101);
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        setupJavascriptBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        setupJavascriptBridge();
    }

    private void setupJavascriptBridge() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                webView.post(() -> {
                    try {
                        webView.addJavascriptInterface(new Object() {
                            @JavascriptInterface
                            public boolean sendDirectSms(String phoneNumber, String message) {
                                try {
                                    SmsManager smsManager;
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                                        smsManager = getSystemService(SmsManager.class);
                                    } else {
                                        smsManager = SmsManager.getDefault();
                                    }
                                    ArrayList<String> parts = smsManager.divideMessage(message);
                                    if (parts.size() > 1) {
                                        smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null);
                                    } else {
                                        smsManager.sendTextMessage(phoneNumber, null, message, null, null);
                                    }
                                    return true;
                                } catch (Exception e) {
                                    e.printStackTrace();
                                    return false;
                                }
                            }
                        }, "AndroidSmsBridge");
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
