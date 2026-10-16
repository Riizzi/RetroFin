package app.retrofin;

import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;

/** Ponte JS ⇄ Android do leitor de notificações. */
@CapacitorPlugin(name = "RetroFinNative")
public class RetroFinNativePlugin extends Plugin {

    private static volatile RetroFinNativePlugin instancia;

    @Override
    public void load() {
        instancia = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instancia == this) instancia = null;
    }

    /** Chamado pelo listener: se o app estiver aberto, o JS processa na hora. */
    static void avisarNovaNotificacao() {
        RetroFinNativePlugin p = instancia;
        if (p != null) p.notifyListeners("notificacao", new JSObject());
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        r.put("permitido", NotificationManagerCompat.getEnabledListenerPackages(c).contains(c.getPackageName()));
        r.put("pendentes", NotifStore.fila(c).length());
        r.put("ultima", NotifStore.ultima(c));
        try {
            r.put("pacotes", new JSArray(NotifStore.pacotes(c).toString()));
        } catch (JSONException e) {
            r.put("pacotes", new JSArray());
        }
        call.resolve(r);
    }

    @PluginMethod
    public void openListenerSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void pull(PluginCall call) {
        JSObject r = new JSObject();
        try {
            r.put("items", new JSArray(NotifStore.fila(getContext()).toString()));
        } catch (JSONException e) {
            r.put("items", new JSArray());
        }
        call.resolve(r);
    }

    @PluginMethod
    public void ack(PluginCall call) {
        JSArray ids = call.getArray("ids");
        if (ids != null) NotifStore.confirmar(getContext(), ids);
        call.resolve();
    }

    @PluginMethod
    public void setPackages(PluginCall call) {
        JSArray pacotes = call.getArray("packages");
        if (pacotes == null) {
            call.reject("Informe a lista de pacotes.");
            return;
        }
        NotifStore.setPacotes(getContext(), pacotes);
        call.resolve();
    }
}
