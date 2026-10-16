package app.retrofin;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Fila das notificações de banco capturadas com o app fechado. O JavaScript "puxa" ao abrir
 * e confirma (ack) o que já virou lançamento. SharedPreferences + commit(): o processo pode
 * morrer logo depois do listener terminar.
 */
final class NotifStore {
    private static final String PREFS = "retrofin_notif";
    private static final Object LOCK = new Object();
    private static final int MAX_FILA = 500;
    private static final long JANELA_DUPLICADA_MS = 10 * 60 * 1000L;

    static final String[] BANCOS_PADRAO = {
        "com.nu.production",       // Nubank
        "br.com.intermedium",      // Inter
        "com.itau",                // Itaú
        "com.itau.pers",           // Itaú Personnalité
        "com.itau.iti",            // iti
        "com.bradesco",            // Bradesco
        "br.com.bradesco.next",    // next
        "com.santander.app",       // Santander
        "com.c6bank.app",          // C6 Bank
        "br.com.gabba.Caixa",      // Caixa
        "br.gov.caixa.tem",        // Caixa Tem
        "br.com.bb.android",       // Banco do Brasil
        "com.mercadopago.wallet",  // Mercado Pago
        "com.picpay"               // PicPay
    };

    private NotifStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONArray arr(SharedPreferences p, String k) {
        try {
            return new JSONArray(p.getString(k, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static JSONArray pacotes(Context c) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            if (!p.contains("pacotes")) {
                JSONArray a = new JSONArray();
                for (String s : BANCOS_PADRAO) a.put(s);
                return a;
            }
            return arr(p, "pacotes");
        }
    }

    static boolean monitorado(Context c, String pkg) {
        JSONArray a = pacotes(c);
        for (int i = 0; i < a.length(); i++) if (pkg.equals(a.optString(i))) return true;
        return false;
    }

    static void setPacotes(Context c, JSONArray a) {
        synchronized (LOCK) {
            prefs(c).edit().putString("pacotes", a.toString()).commit();
        }
    }

    /** Guarda a notificação. Retorna false se for repetição recente (bancos às vezes atualizam a mesma). */
    static boolean adicionar(Context c, JSONObject item, String assinatura, long agora) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            JSONArray recentes = arr(p, "recentes");
            JSONArray novosRecentes = new JSONArray();
            boolean repetida = false;
            for (int i = 0; i < recentes.length(); i++) {
                JSONObject r = recentes.optJSONObject(i);
                if (r == null || agora - r.optLong("t") > JANELA_DUPLICADA_MS) continue;
                if (assinatura.equals(r.optString("h"))) repetida = true;
                novosRecentes.put(r);
            }
            if (repetida) {
                p.edit().putString("recentes", novosRecentes.toString()).commit();
                return false;
            }
            try {
                novosRecentes.put(new JSONObject().put("h", assinatura).put("t", agora));
            } catch (JSONException ignored) {
            }
            JSONArray fila = arr(p, "fila");
            fila.put(item);
            while (fila.length() > MAX_FILA) fila.remove(0);
            p.edit()
                .putString("fila", fila.toString())
                .putString("recentes", novosRecentes.toString())
                .putLong("ultima", agora)
                .commit();
            return true;
        }
    }

    static JSONArray fila(Context c) {
        synchronized (LOCK) {
            return arr(prefs(c), "fila");
        }
    }

    static void confirmar(Context c, JSONArray ids) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            JSONArray fila = arr(p, "fila");
            JSONArray resto = new JSONArray();
            for (int i = 0; i < fila.length(); i++) {
                JSONObject o = fila.optJSONObject(i);
                if (o == null) continue;
                boolean tirar = false;
                for (int j = 0; j < ids.length(); j++) {
                    if (o.optString("id").equals(ids.optString(j))) {
                        tirar = true;
                        break;
                    }
                }
                if (!tirar) resto.put(o);
            }
            p.edit().putString("fila", resto.toString()).commit();
        }
    }

    static long ultima(Context c) {
        return prefs(c).getLong("ultima", 0L);
    }
}
