package org.openchinese.reader;
import java.io.*;import java.nio.file.*;import java.util.zip.*;
public final class EpubArchiveTest {
    static void zip(File file,String path,String body)throws Exception{try(ZipOutputStream z=new ZipOutputStream(new FileOutputStream(file))){z.putNextEntry(new ZipEntry(path));z.write(body.getBytes("UTF-8"));z.closeEntry();}}
    public static void main(String[] args)throws Exception{
        File root=Files.createTempDirectory("openchinese-import-test-").toFile();
        EpubArchive.Book b=EpubArchive.open(new File(args[0]),new File(root,"books"));
        if(b.chapters.isEmpty()||b.title.isEmpty()||b.id.length()!=24)throw new AssertionError("Invalid imported book");
        File library=new File(root,"books"),original=new File(library,b.id),other=new File(library,"aaaaaaaaaaaaaaaaaaaaaaaa/keep.txt");
        other.getParentFile().mkdirs();Files.write(other.toPath(),"Keep another book".getBytes("UTF-8"));
        try{EpubArchive.stageRemoval(library,"../outside");throw new AssertionError("Invalid deletion ID accepted");}catch(IOException expected){}
        EpubArchive.Removal removal=EpubArchive.stageRemoval(library,b.id);
        if(original.exists()||!other.isFile())throw new AssertionError("Removal staging escaped its book");
        removal.restore();if(!original.isDirectory())throw new AssertionError("Failed-state-save rollback lost book");
        EpubArchive.stageRemoval(library,b.id).finish();
        if(original.exists()||!other.isFile()||!new File(args[0]).isFile())throw new AssertionError("Removal changed another book or original EPUB");
        File[] leftover=library.listFiles((dir,name)->name.startsWith(".deleted-"));
        if(leftover==null||leftover.length!=0)throw new AssertionError("Private resources were not deleted");
        EpubArchive.stageRemoval(library,b.id).finish();
        EpubArchive.open(new File(args[0]),library);if(!original.isDirectory())throw new AssertionError("Cannot re-import deleted book");
        File malicious=new File(root,"traversal.epub");zip(malicious,"../outside.txt","bad");
        try{EpubArchive.open(malicious,new File(root,"unsafe"));throw new AssertionError("Traversal was accepted");}catch(IOException expected){}
        if(new File(root,"unsafe/outside.txt").exists())throw new AssertionError("Unsafe resource written");
        File encrypted=new File(root,"encrypted.epub");zip(encrypted,"META-INF/encryption.xml","<encryption/>");
        try{EpubArchive.open(encrypted,new File(root,"encrypted"));throw new AssertionError("Encrypted EPUB was accepted");}catch(IOException expected){}
        System.out.println("PASS native EPUB import and deletion: staged rollback, private resource cleanup, original and other book preserved, re-import, invalid deletion ID rejected; ZIP traversal and encrypted EPUB rejected. Chapters="+b.chapters.size());
    }
}
