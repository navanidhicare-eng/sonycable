package com.sonycable.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

@CapacitorPlugin(
    name = "DirectSms",
    permissions = {
        @Permission(
            strings = { Manifest.permission.SEND_SMS },
            alias = "sms"
        )
    }
)
public class DirectSmsPlugin extends Plugin {

    @PluginMethod
    public void sendDirectSms(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber");
        String message = call.getString("message");

        if (phoneNumber == null || message == null) {
            call.reject("phoneNumber and message are required");
            return;
        }

        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermissionCallback");
            return;
        }

        sendSmsInternal(phoneNumber, message, call);
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED) {
            String phoneNumber = call.getString("phoneNumber");
            String message = call.getString("message");
            sendSmsInternal(phoneNumber, message, call);
        } else {
            call.reject("Permission to send SMS was denied");
        }
    }

    private void sendSmsInternal(String phoneNumber, String message, PluginCall call) {
        try {
            SmsManager smsManager;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                smsManager = getContext().getSystemService(SmsManager.class);
            } else {
                smsManager = SmsManager.getDefault();
            }

            ArrayList<String> parts = smsManager.divideMessage(message);
            if (parts.size() > 1) {
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null);
            } else {
                smsManager.sendTextMessage(phoneNumber, null, message, null, null);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error sending SMS: " + e.getMessage());
        }
    }
}
