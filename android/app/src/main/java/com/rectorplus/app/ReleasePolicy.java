package com.rectorplus.app;
import java.io.*;
import java.security.*;
import java.security.spec.X509EncodedKeySpec;
import java.util.zip.*;
public final class ReleasePolicy {
 private ReleasePolicy(){}
 public static boolean compatible(int nativeCode,int api,int min,int max,int requiredApi){return min>0&&max>=min&&nativeCode>=min&&nativeCode<=max&&api==requiredApi;}
 public static boolean newer(long current,long candidate,long failed){return candidate>current&&candidate!=failed;}
 public static boolean verify(byte[] payload,byte[] signature,byte[] publicKey)throws Exception{Signature verifier=Signature.getInstance("SHA256withRSA");verifier.initVerify(KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(publicKey)));verifier.update(payload);return verifier.verify(signature);}
 public static void unpack(File zip,File directory)throws IOException{
  String root=directory.getCanonicalPath()+File.separator;long total=0;int count=0;byte[] buffer=new byte[32768];
  try(ZipInputStream input=new ZipInputStream(new FileInputStream(zip))){ZipEntry entry;while((entry=input.getNextEntry())!=null){
   String name=entry.getName();if(++count>6000||name.startsWith("/")||name.contains("\\")||name.contains(":")||name.contains("\0"))throw new IOException("Archive path refused");
   File file=new File(directory,name);if(!file.getCanonicalPath().startsWith(root))throw new IOException("Archive traversal refused");
   if(entry.isDirectory()){if(!file.isDirectory()&&!file.mkdirs())throw new IOException("Cannot create directory");continue;}
   String lower=name.toLowerCase(java.util.Locale.ROOT);if(!lower.matches(".*\\.(html|js|css|json|svg|png|jpg|jpeg|webp|gif|ico|woff|woff2|ttf|txt|map|pdf)$"))throw new IOException("Only web assets are permitted");
   File parent=file.getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())throw new IOException("Cannot create directory");
   if(file.exists())throw new IOException("Duplicate archive entry");
   try(OutputStream out=new FileOutputStream(file)){int n;while((n=input.read(buffer))!=-1){total+=n;if(total>100L*1024*1024)throw new IOException("Archive expansion limit");out.write(buffer,0,n);}}
  }}
  if(!new File(directory,"index.html").isFile())throw new IOException("Missing index.html");
 }
}
