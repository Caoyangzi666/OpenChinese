package org.openchinese.reader;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.util.AtomicFile;
import org.json.*;
import org.w3c.dom.*;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.*;

public class MainActivity extends Activity {
    private WebView web;
    private File books;
    private String pendingExport;
    private static final String ORIGIN="https://openchinese.local";
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved); books=new File(getFilesDir(),"books");books.mkdirs();
        web=new WebView(this);setContentView(web);
        WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(false);
        s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false);web.setWebContentsDebuggingEnabled(false);
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(),"OpenChineseNative");
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest r){return !r.getUrl().toString().startsWith(ORIGIN+"/");}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest r){
                try {
                    Uri uri=r.getUrl();if(!"openchinese.local".equals(uri.getHost()))return denied();
                    String path=uri.getPath();InputStream input;String mime;
                    if(path.startsWith("/books/")) {
                        File f=contained(books,path.substring(7));
                        String ext=f.getName().toLowerCase(Locale.ROOT);
                        if(ext.endsWith(".html")||ext.endsWith(".xhtml")||ext.endsWith(".htm")||ext.endsWith(".js"))return denied();
                        input=new FileInputStream(f);mime=mime(f.getName());
                    }else{String asset=path.equals("/")?"web/index.html":path.substring(1);if(asset.contains(".."))return denied();input=getAssets().open(asset);mime=mime(asset);}
                    Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");
                    headers.put("Content-Security-Policy","default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src 'self' about:");
                    return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,input);
                }catch(Exception e){return denied();}
            }
        });web.loadUrl(ORIGIN+"/web/index.html");
    }
    private static WebResourceResponse denied(){return new WebResourceResponse("text/plain","UTF-8",403,"Unavailable",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
    private static String mime(String name){String n=name.toLowerCase(Locale.ROOT);if(n.endsWith(".js"))return "text/javascript";if(n.endsWith(".css"))return "text/css";if(n.endsWith(".json"))return "application/json";if(n.endsWith(".svg"))return "image/svg+xml";if(n.endsWith(".png"))return "image/png";if(n.endsWith(".jpg")||n.endsWith(".jpeg"))return "image/jpeg";if(n.endsWith(".woff2"))return "font/woff2";if(n.endsWith(".ttf"))return "font/ttf";if(n.endsWith(".otf"))return "font/otf";return "text/html";}
    private static File contained(File root,String relative)throws IOException{File f=new File(root,relative).getCanonicalFile();if(!f.getPath().startsWith(root.getCanonicalPath()+File.separator))throw new IOException("Invalid path");return f;}
    private static String read(InputStream in)throws IOException{try(InputStream stream=in;ByteArrayOutputStream b=new ByteArrayOutputStream()){byte[] chunk=new byte[8192];int n;while((n=stream.read(chunk))!=-1)b.write(chunk,0,n);return b.toString("UTF-8");}}
    private void notifyJs(String method,Object value){String json=value instanceof JSONObject||value instanceof JSONArray?value.toString():JSONObject.quote(String.valueOf(value));runOnUiThread(()->web.evaluateJavascript("window."+method+"("+json+")",null));}
    public class Bridge {
        @JavascriptInterface public void setDarkMode(boolean dark){runOnUiThread(()->{
            int color=android.graphics.Color.parseColor(dark?"#141c19":"#f7f5ef");
            getWindow().setStatusBarColor(color);getWindow().setNavigationBarColor(color);web.setBackgroundColor(color);
            int mask=android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            int flags=getWindow().getDecorView().getSystemUiVisibility();
            getWindow().getDecorView().setSystemUiVisibility(dark?flags&~mask:flags|mask);
        });}
        @JavascriptInterface public String getState(){try{return read(new FileInputStream(new File(getFilesDir(),"state.json")));}catch(Exception e){return "{}";}}
        @JavascriptInterface public synchronized boolean saveState(String json){AtomicFile f=new AtomicFile(new File(getFilesDir(),"state.json"));FileOutputStream out=null;try{if(json.length()>10000000)return false;new JSONObject(json);out=f.startWrite();out.write(json.getBytes(StandardCharsets.UTF_8));f.finishWrite(out);return true;}catch(Exception e){if(out!=null)f.failWrite(out);return false;}}
        @JavascriptInterface public void importEpub(){runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("*/*");i.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/epub+zip","application/octet-stream"});startActivityForResult(i,11);});}
        @JavascriptInterface public String readChapter(String id,String relative){try{if(!id.matches("[a-f0-9]{24}"))throw new IOException();return read(new FileInputStream(contained(new File(books,id),relative)));}catch(Exception e){return "";}}
        @JavascriptInterface public synchronized boolean deleteBook(String id,String json){
            try{
                if(json.length()>10000000)return false;
                JSONObject next=new JSONObject(json);JSONArray remaining=next.getJSONArray("books");
                for(int i=0;i<remaining.length();i++)if(id.equals(remaining.getJSONObject(i).getString("id")))return false;
                EpubArchive.Removal removal=EpubArchive.stageRemoval(books,id);
                if(!saveState(json)){removal.restore();return false;}
                removal.finish();return true;
            }catch(Exception e){return false;}
        }
        @JavascriptInterface public void exportCards(String json){try{new JSONObject(json);if(json.length()>10000000)return;pendingExport=json;runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");i.putExtra(Intent.EXTRA_TITLE,"OpenChinese-flashcards.json");startActivityForResult(i,12);});}catch(Exception ignored){}}
        @JavascriptInterface public void importCards(){runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");startActivityForResult(i,13);});}
    }
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(result!=RESULT_OK||data==null)return;Uri uri=data.getData();new Thread(()->{try{
        if(request==11)notifyJs("onBookImported",importBook(uri));
        else if(request==12){try(OutputStream out=getContentResolver().openOutputStream(uri)){out.write(pendingExport.getBytes(StandardCharsets.UTF_8));}notifyJs("nativeMessage","Flashcards exported");}
        else if(request==13){String text=read(getContentResolver().openInputStream(uri));if(text.length()>10000000)throw new IOException("Backup too large");notifyJs("onCardsImported",new JSONObject(text));}
    }catch(Exception e){notifyJs("nativeError",e.getMessage()==null?"Unable to open this file":e.getMessage());}},"OpenChinese-files").start();}
    private JSONObject importBook(Uri uri)throws Exception{
        File temp=File.createTempFile("epub-",".zip",getCacheDir());
        try {
            long total=0;
            try(InputStream in=getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(temp)){
                byte[] b=new byte[32768];int n;while((n=in.read(b))!=-1){total+=n;if(total>100000000)throw new IOException("EPUB exceeds 100 MB");out.write(b,0,n);}
            }
            EpubArchive.Book imported=EpubArchive.open(temp,books);
            JSONArray chapters=new JSONArray();for(String path:imported.chapters)chapters.put(new JSONObject().put("path",path).put("title","Chapter "+(chapters.length()+1)));
            return new JSONObject().put("id",imported.id).put("title",imported.title).put("author",imported.author).put("chapters",chapters).put("added",System.currentTimeMillis()).put("chapter",0).put("scroll",0);
        }finally{temp.delete();}
    }
    @Override public void onBackPressed(){web.evaluateJavascript("window.handleAndroidBack()",null);}
    @Override public void onPause(){super.onPause();web.evaluateJavascript("window.persistPosition && window.persistPosition()",null);}
}
