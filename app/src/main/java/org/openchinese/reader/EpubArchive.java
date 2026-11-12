package org.openchinese.reader;

import java.io.*;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.FileVisitResult;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.*;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.*;
import org.xml.sax.InputSource;

/** Android-independent EPUB importer, shared by the app and the desktop tests. */
public final class EpubArchive {
    /** Stage a private book removal so a failed state save can restore it. */
    public static final class Removal {
        private final File original,trash;
        private Removal(File original,File trash){this.original=original;this.trash=trash;}
        public void restore()throws IOException{if(trash!=null&&!trash.renameTo(original))throw new IOException("Unable to restore book");}
        public void finish(){
            if(trash==null)return;
            try{Files.walkFileTree(trash.toPath(),new SimpleFileVisitor<Path>(){
                @Override public FileVisitResult visitFile(Path file,BasicFileAttributes attrs)throws IOException{Files.delete(file);return FileVisitResult.CONTINUE;}
                @Override public FileVisitResult postVisitDirectory(Path dir,IOException error)throws IOException{if(error!=null)throw error;Files.delete(dir);return FileVisitResult.CONTINUE;}
            });}catch(IOException e){System.err.println("OpenChinese: pending private book cleanup: "+e.getMessage());}
        }
    }
    public static Removal stageRemoval(File library,String id)throws IOException{
        if(id==null||!id.matches("[a-f0-9]{24}"))throw new IOException("Invalid book identifier");
        File root=library.getCanonicalFile(),target=new File(root,id);
        if(!target.getCanonicalFile().equals(target))throw new IOException("Invalid book directory");
        if(!target.exists())return new Removal(target,null);
        File trash=new File(root,".deleted-"+id+"-"+UUID.randomUUID());
        if(!target.renameTo(trash))throw new IOException("Unable to remove book files");
        return new Removal(target,trash);
    }
    public static final class Book {
        public String id,title,author;
        public final List<String> chapters=new ArrayList<>();
    }
    private static File contained(File root,String path)throws IOException {
        File f=new File(root,path).getCanonicalFile();
        if(!f.getPath().startsWith(root.getCanonicalPath()+File.separator))throw new IOException("EPUB contains an unsafe resource path");
        return f;
    }
    public static Book open(File archive,File library)throws Exception {
        if(archive.length()>100000000)throw new IOException("EPUB exceeds 100 MB");
        MessageDigest md=MessageDigest.getInstance("SHA-256");
        try(InputStream in=new FileInputStream(archive)){byte[] b=new byte[32768];int n;while((n=in.read(b))!=-1)md.update(b,0,n);}
        StringBuilder hex=new StringBuilder();for(byte b:md.digest())hex.append(String.format("%02x",b));
        Book book=new Book();book.id=hex.substring(0,24);File folder=new File(library,book.id);folder.mkdirs();
        try(ZipFile zip=new ZipFile(archive)){
            if(zip.getEntry("META-INF/encryption.xml")!=null)throw new IOException("Encrypted or font-obfuscated EPUBs are not yet supported");
            long total=0;int count=0;Enumeration<? extends ZipEntry> entries=zip.entries();
            while(entries.hasMoreElements()){
                ZipEntry e=entries.nextElement();if(++count>12000)throw new IOException("Too many EPUB resources");
                File target=contained(folder,e.getName());if(e.isDirectory()){target.mkdirs();continue;}target.getParentFile().mkdirs();
                try(InputStream in=zip.getInputStream(e);OutputStream out=new FileOutputStream(target)){
                    byte[] b=new byte[16384];int n;while((n=in.read(b))!=-1){total+=n;if(total>220000000)throw new IOException("Expanded EPUB exceeds 220 MB");out.write(b,0,n);}
                }
            }
        }
        Document container=parse(contained(folder,"META-INF/container.xml"));NodeList roots=container.getElementsByTagNameNS("*","rootfile");
        if(roots.getLength()==0)throw new IOException("Missing EPUB package");
        File packageFile=contained(folder,((Element)roots.item(0)).getAttribute("full-path"));Document doc=parse(packageFile);
        book.title=text(doc,"title");book.author=text(doc,"creator");if(book.title.isEmpty())book.title="Imported book";
        Map<String,String> manifest=new HashMap<>();NodeList items=doc.getElementsByTagNameNS("*","item");
        for(int i=0;i<items.getLength();i++){
            Element e=(Element)items.item(i);String href=URLDecoder.decode(e.getAttribute("href").split("#",2)[0].replace("+","%2B"),"UTF-8");
            File f=new File(packageFile.getParentFile(),href).getCanonicalFile();
            if(!f.getPath().startsWith(folder.getCanonicalPath()+File.separator))throw new IOException("EPUB package refers outside its book folder");
            manifest.put(e.getAttribute("id"),f.getPath().substring(folder.getCanonicalPath().length()+1).replace('\\','/'));
        }
        NodeList spine=doc.getElementsByTagNameNS("*","itemref");
        for(int i=0;i<spine.getLength();i++){Element e=(Element)spine.item(i);if("no".equals(e.getAttribute("linear")))continue;String path=manifest.get(e.getAttribute("idref"));if(path!=null&&contained(folder,path).isFile())book.chapters.add(path);}
        if(book.chapters.isEmpty())throw new IOException("No readable chapters in EPUB");return book;
    }
    private static Document parse(File file)throws Exception {
        if(file.length()>3000000)throw new IOException("EPUB package XML is too large");
        String xml=new String(Files.readAllBytes(file.toPath()),StandardCharsets.UTF_8);
        if(xml.toUpperCase(Locale.ROOT).contains("<!DOCTYPE")||xml.toUpperCase(Locale.ROOT).contains("<!ENTITY"))throw new IOException("External XML declarations are not supported");
        DocumentBuilderFactory factory=DocumentBuilderFactory.newInstance();factory.setNamespaceAware(true);
        javax.xml.parsers.DocumentBuilder builder=factory.newDocumentBuilder();
        builder.setEntityResolver((publicId,systemId)->new InputSource(new StringReader("")));
        return builder.parse(new InputSource(new StringReader(xml)));
    }
    private static String text(Document d,String name){NodeList n=d.getElementsByTagNameNS("*",name);return n.getLength()==0?"":n.item(0).getTextContent().trim();}
}
