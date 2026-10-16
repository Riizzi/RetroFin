package app.retrofin;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.UUID;
import java.util.regex.Pattern;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Lê as notificações dos apps de banco (com o RetroFin fechado) e guarda na fila do NotifStore.
 * O Android mantém este serviço vivo enquanto o "Acesso a notificações" estiver liberado.
 * Só textos de apps monitorados e com valor em reais são guardados; nada sai do aparelho.
 */
public class BankNotificationListener extends NotificationListenerService {

    private static final Pattern VALOR = Pattern.compile("\\d+,\\d{2}");

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String pkg = sbn.getPackageName();
            if (pkg == null || !NotifStore.monitorado(this, pkg)) return;

            Notification n = sbn.getNotification();
            if (n == null) return;
            if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;

            Bundle ex = n.extras;
            if (ex == null) return;
            String titulo = texto(ex.getCharSequence(Notification.EXTRA_TITLE));
            String corpo = texto(ex.getCharSequence(Notification.EXTRA_BIG_TEXT));
            if (corpo.isEmpty()) corpo = texto(ex.getCharSequence(Notification.EXTRA_TEXT));
            if (corpo.isEmpty() && titulo.isEmpty()) return;
            if (!VALOR.matcher(titulo + " " + corpo).find()) return;

            long agora = System.currentTimeMillis();
            long postada = sbn.getPostTime() > 0 ? sbn.getPostTime() : agora;

            JSONObject item = new JSONObject();
            item.put("id", UUID.randomUUID().toString());
            item.put("pkg", pkg);
            item.put("app", nomeDoApp(pkg));
            item.put("title", titulo);
            item.put("text", corpo);
            item.put("postedAt", postada);

            String assinatura = pkg + "|" + titulo + "|" + corpo;
            if (NotifStore.adicionar(this, item, Integer.toHexString(assinatura.hashCode()) + ":" + assinatura.length(), agora)) {
                RetroFinNativePlugin.avisarNovaNotificacao();
            }
        } catch (JSONException | RuntimeException e) {
            // Nunca derrubar o serviço por causa de uma notificação estranha.
        }
    }

    private static String texto(CharSequence cs) {
        return cs == null ? "" : cs.toString().trim();
    }

    private String nomeDoApp(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(ai).toString();
        } catch (Exception e) {
            return pkg;
        }
    }
}
