package com.rectorplus.app;
import android.Manifest;import android.app.Activity;import androidx.activity.result.ActivityResult;import java.io.OutputStream;import android.content.Intent;import android.net.Uri;import android.os.Build;
import com.getcapacitor.*;import com.getcapacitor.annotation.*;
import java.util.concurrent.*;
@CapacitorPlugin(name="RectorUpdates",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class RectorUpdatesPlugin extends Plugin {
 private static final ExecutorService WORKER=Executors.newSingleThreadExecutor();
 private MobileUpdates manager(){return new MobileUpdates(getContext());}
 private void resolveStatus(PluginCall call){try{call.resolve(new JSObject(manager().status().toString()));}catch(Exception error){call.reject("Statut de mise à jour indisponible");}}
 @PluginMethod public void status(PluginCall call){resolveStatus(call);}
 @PluginMethod public void check(PluginCall call){WORKER.execute(()->{try{manager().check(Boolean.TRUE.equals(call.getBoolean("userInitiated",false)));resolveStatus(call);}catch(Exception error){call.reject("La vérification est indisponible. La version actuelle est conservée.");}});}
 @PluginMethod public void confirmReady(PluginCall call){manager().confirm(call.getLong("build",0L));resolveStatus(call);}
 @PluginMethod public void applyReady(PluginCall call){getActivity().runOnUiThread(()->{String path=manager().prepareLaunch();if(path==null)getBridge().setServerAssetPath("public");else getBridge().setServerBasePath(path);call.resolve();});}
 @PluginMethod public void rollback(PluginCall call){getActivity().runOnUiThread(()->{String path=manager().rollback();if(path==null)getBridge().setServerAssetPath("public");else getBridge().setServerBasePath(path);call.resolve();});}
 @PluginMethod public void openStore(PluginCall call){try{getActivity().startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(MobileUpdates.STORE)));call.resolve();}catch(Exception error){call.reject("Le Play Store ne peut pas être ouvert.");}}
 @PluginMethod public void notifications(PluginCall call){boolean enable=Boolean.TRUE.equals(call.getBoolean("enabled",false));if(!enable){manager().setNotifications(false);resolveStatus(call);return;}if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED){requestPermissionForAlias("notifications",call,"notificationsResult");return;}manager().setNotifications(true);resolveStatus(call);}
 @PermissionCallback private void notificationsResult(PluginCall call){manager().setNotifications(getPermissionState("notifications")==PermissionState.GRANTED);resolveStatus(call);}

 private byte[] exportBytes;
 @PluginMethod public void saveFile(PluginCall call){
  if(exportBytes!=null){call.reject("Terminez l’enregistrement précédent.");return;}
  String data=call.getString("data",""),mime=call.getString("mime","application/octet-stream"),name=call.getString("name","RectorPlus.pdf");
  if(data.length()>28*1024*1024||!mime.matches("application/pdf|application/vnd.openxmlformats-officedocument.spreadsheetml.sheet|text/csv|application/json")){call.reject("Export non pris en charge.");return;}
  try{exportBytes=android.util.Base64.decode(data,android.util.Base64.DEFAULT);Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(mime);intent.putExtra(Intent.EXTRA_TITLE,name.replaceAll("[/\\\\:]","_"));startActivityForResult(call,intent,"fileCreated");}catch(Exception error){exportBytes=null;call.reject("Impossible de préparer le fichier.");}
 }
 @ActivityCallback private void fileCreated(PluginCall call,ActivityResult result){
  if(call==null){exportBytes=null;return;}if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null||result.getData().getData()==null){exportBytes=null;call.resolve(new JSObject().put("cancelled",true));return;}
  byte[] bytes=exportBytes;WORKER.execute(()->{try(OutputStream out=getContext().getContentResolver().openOutputStream(result.getData().getData())){if(out==null||bytes==null)throw new java.io.IOException();out.write(bytes);call.resolve(new JSObject().put("saved",true));}catch(Exception error){call.reject("Le fichier ne peut pas être enregistré.");}finally{exportBytes=null;}});
 }
}
