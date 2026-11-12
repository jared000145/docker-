package com.rectorplus.app;
import android.app.*;
import android.content.*;
import android.net.*;
import android.os.Build;
import android.util.Base64;
import androidx.core.app.NotificationCompat;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.Locale;
public final class MobileUpdates {
 public static final String HOST="rectorplus.vercel.app",STORE="https://play.google.com/store/apps/details?id=com.rectorplus.app";
 private final Context context;private final SharedPreferences prefs;private final File root;
 public MobileUpdates(Context context){this.context=context.getApplicationContext();prefs=this.context.getSharedPreferences("rectorplus-updates-v1",Context.MODE_PRIVATE);root=new File(this.context.getFilesDir(),"web-releases");}
 private String safePath(String path){try{if(path==null||path.isEmpty())return null;File file=new File(path);return file.getCanonicalPath().startsWith(root.getCanonicalPath()+File.separator)&&new File(file,"index.html").isFile()?file.getCanonicalPath():null;}catch(IOException error){return null;}}
 public synchronized String prepareLaunch(){
  if(prefs.getInt("binary",0)!=BuildConfig.VERSION_CODE){prefs.edit().clear().putInt("binary",BuildConfig.VERSION_CODE).putLong("activeBuild",BuildConfig.WEB_BUILD).commit();context.getSharedPreferences("CapWebViewSettings",0).edit().remove("serverBasePath").commit();}
  if(prefs.getBoolean("trial",false))rollback();
  String pending=safePath(prefs.getString("pendingPath",null));
  if(pending!=null&&ReleasePolicy.newer(prefs.getLong("activeBuild",BuildConfig.WEB_BUILD),prefs.getLong("pendingBuild",0),prefs.getLong("failedBuild",0))){
   prefs.edit().putString("previousPath",prefs.getString("activePath",null)).putLong("previousBuild",prefs.getLong("activeBuild",BuildConfig.WEB_BUILD)).putString("previousVersion",prefs.getString("activeVersion",BuildConfig.WEB_VERSION)).putString("activePath",pending).putLong("activeBuild",prefs.getLong("pendingBuild",0)).putString("activeVersion",prefs.getString("pendingVersion",BuildConfig.WEB_VERSION)).putBoolean("trial",true).remove("pendingPath").remove("pendingBuild").commit();
  }
  return safePath(prefs.getString("activePath",null));
 }
 public synchronized String rollback(){
  prefs.edit().putLong("failedBuild",prefs.getLong("activeBuild",BuildConfig.WEB_BUILD)).putString("activePath",safePath(prefs.getString("previousPath",null))).putLong("activeBuild",prefs.getLong("previousBuild",BuildConfig.WEB_BUILD)).putString("activeVersion",prefs.getString("previousVersion",BuildConfig.WEB_VERSION)).putBoolean("trial",false).putBoolean("rolledBack",true).remove("pendingPath").commit();return safePath(prefs.getString("activePath",null));
 }
 public void confirm(long webBuild){if(webBuild==prefs.getLong("activeBuild",BuildConfig.WEB_BUILD))prefs.edit().putBoolean("trial",false).apply();}
 public void setNotifications(boolean value){prefs.edit().putBoolean("notifications",value).apply();}
 public JSONObject status()throws JSONException{return new JSONObject().put("nativeVersion",BuildConfig.VERSION_NAME).put("nativeCode",BuildConfig.VERSION_CODE).put("webVersion",prefs.getString("activeVersion",BuildConfig.WEB_VERSION)).put("webBuild",prefs.getLong("activeBuild",BuildConfig.WEB_BUILD)).put("pendingVersion",prefs.getString("pendingPath",null)!=null?prefs.getString("pendingVersion",""):"").put("storeVersion",prefs.getString("storeVersion","")).put("storeAvailable",prefs.getBoolean("storeAvailable",false)).put("notifications",prefs.getBoolean("notifications",false)).put("rolledBack",prefs.getBoolean("rolledBack",false)).put("channel",BuildConfig.RELEASE_CHANNEL);}
 private HttpURLConnection open(String address)throws IOException{
  URL url=new URL(address);if(!url.getProtocol().equals("https")||!url.getHost().equals(HOST)||url.getUserInfo()!=null||url.getPort()!=-1)throw new IOException("Untrusted update URL");
  HttpURLConnection connection=(HttpURLConnection)url.openConnection();connection.setConnectTimeout(10000);connection.setReadTimeout(20000);connection.setInstanceFollowRedirects(false);connection.setRequestProperty("Cache-Control","no-cache");if(connection.getResponseCode()!=200){connection.disconnect();throw new IOException("Update unavailable");}return connection;
 }
 private static byte[] readLimited(InputStream input,int max)throws IOException{try(ByteArrayOutputStream output=new ByteArrayOutputStream()){byte[] buffer=new byte[8192];int n;while((n=input.read(buffer))!=-1){if(output.size()+n>max)throw new IOException("Response too large");output.write(buffer,0,n);}return output.toByteArray();}}
 public void check(boolean allowMetered)throws Exception{synchronized(MobileUpdates.class){checkInternal(allowMetered);}}
 private void checkInternal(boolean allowMetered)throws Exception{
  HttpURLConnection manifestConnection=open("https://"+HOST+"/mobile/updates-"+BuildConfig.RELEASE_CHANNEL+".json");byte[] envelope;try(InputStream input=manifestConnection.getInputStream()){envelope=readLimited(input,65536);}finally{manifestConnection.disconnect();}
  JSONObject wrapper=new JSONObject(new String(envelope,StandardCharsets.UTF_8));String raw=wrapper.getString("payload");byte[] publicKey;try(InputStream input=context.getResources().openRawResource(R.raw.mobile_update_public)){publicKey=readLimited(input,8192);}
  if(!ReleasePolicy.verify(raw.getBytes(StandardCharsets.UTF_8),Base64.decode(wrapper.getString("signature"),Base64.DEFAULT),publicKey))throw new SecurityException("Update signature refused");
  JSONObject manifest=new JSONObject(raw);if(manifest.getInt("schema")!=1||!manifest.getString("channel").equals(BuildConfig.RELEASE_CHANNEL)||manifest.getLong("serial")<prefs.getLong("serial",0))throw new SecurityException("Stale or invalid manifest");
  JSONObject nativeRelease=manifest.getJSONObject("native"),web=manifest.getJSONObject("web");boolean storeAvailable=nativeRelease.getBoolean("published")&&nativeRelease.getInt("code")>BuildConfig.VERSION_CODE;
  prefs.edit().putLong("serial",manifest.getLong("serial")).putBoolean("storeAvailable",storeAvailable).putString("storeVersion",storeAvailable?nativeRelease.getString("version"):"").apply();if(storeAvailable)notifyStore(nativeRelease.getString("version"));
  if(!ReleasePolicy.compatible(BuildConfig.VERSION_CODE,BuildConfig.NATIVE_API,web.getInt("minNativeCode"),web.getInt("maxNativeCode"),web.getInt("nativeApi")))return;
  long build=web.getLong("build");if(!ReleasePolicy.newer(prefs.getLong("activeBuild",BuildConfig.WEB_BUILD),build,prefs.getLong("failedBuild",0))||build==prefs.getLong("pendingBuild",0))return;
  ConnectivityManager network=(ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);if(!allowMetered&&network!=null&&network.isActiveNetworkMetered())return;
  String address=web.getString("url"),sha=web.getString("sha256");URL parsed=new URL(address);if(!parsed.getPath().startsWith("/mobile/bundles/")||parsed.getQuery()!=null||parsed.getRef()!=null||!sha.matches("[a-f0-9]{64}"))throw new SecurityException("Invalid web bundle");
  if(!root.isDirectory()&&!root.mkdirs())throw new IOException("Cannot prepare update storage");
  File archive=new File(root,"download-"+build+".tmp"),temporary=new File(root,"prepare-"+build+"-"+System.nanoTime()),ready=new File(root,"release-"+build);
  try{
   MessageDigest digest=MessageDigest.getInstance("SHA-256");HttpURLConnection bundle=open(address);long total=0;
   try(InputStream input=bundle.getInputStream();OutputStream output=new FileOutputStream(archive)){byte[] buffer=new byte[32768];int n;while((n=input.read(buffer))!=-1){total+=n;if(total>40L*1024*1024)throw new IOException("Bundle limit");digest.update(buffer,0,n);output.write(buffer,0,n);}}finally{bundle.disconnect();}
   StringBuilder hex=new StringBuilder();for(byte value:digest.digest())hex.append(String.format(Locale.ROOT,"%02x",value&255));if(!hex.toString().equals(sha))throw new SecurityException("Bundle integrity refused");
   if(!temporary.mkdirs())throw new IOException("Cannot stage update");ReleasePolicy.unpack(archive,temporary);
   if(ready.exists())deleteInside(ready);if(!temporary.renameTo(ready))throw new IOException("Atomic update activation failed");
   prefs.edit().putString("pendingPath",ready.getCanonicalPath()).putLong("pendingBuild",build).putString("pendingVersion",web.getString("version")).commit();
  }finally{if(archive.exists())archive.delete();if(temporary.exists())deleteInside(temporary);}
 }
 private void deleteInside(File file)throws IOException{if(!file.getCanonicalPath().startsWith(root.getCanonicalPath()+File.separator))throw new IOException("Unsafe cleanup refused");File[] children=file.listFiles();if(children!=null)for(File child:children)deleteInside(child);if(!file.delete())throw new IOException("Cannot clear staged files");}
 private void notifyStore(String version){
  if(!prefs.getBoolean("notifications",false)||version.equals(prefs.getString("lastNotified","")))return;
  NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);if(manager==null||!manager.areNotificationsEnabled())return;
  if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(new NotificationChannel("app-updates","Mises à jour de RectorPlus",NotificationManager.IMPORTANCE_DEFAULT));
  Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse(STORE));PendingIntent pending=PendingIntent.getActivity(context,8301,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  try{manager.notify(8301,new NotificationCompat.Builder(context,"app-updates").setSmallIcon(R.drawable.ic_stat_rectorplus).setContentTitle("RectorPlus "+version+" est disponible").setContentText("Téléchargez la nouvelle version depuis le Play Store.").setContentIntent(pending).setAutoCancel(true).build());prefs.edit().putString("lastNotified",version).apply();}catch(SecurityException ignored){}
 }
}
