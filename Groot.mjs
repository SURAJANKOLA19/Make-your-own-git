#!/usr/bin/env node 

import path from  'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { timeStamp } from 'console';
import { diffLines } from 'diff';
import chalk from 'chalk';
import { program } from 'commander';
//import { Command } from 'commander';

// const program = new Command();

class Groot{
    constructor(repoPath = '.'){
        
        this.repoPath = path.join(repoPath,'.groot');
        this.objectsPath= path.join(this.repoPath,'object');
        this.headPath = path.join(this.repoPath,'HEAD');
        this.indexPath =path.join(this.repoPath,'index');
        this.init();
    }

    async init(){
        await fs.mkdir(this.objectsPath,{recursive:true});
        try{
            await fs.writeFile(this.headPath,'',{flag:'wx'});
            await fs.writeFile(this.indexPath,JSON.stringify([]),{flag:'wx'});
        }catch(error){
            console.log('Already intialised the .groot folder');
        }

         
    }
    hashObject(content){
        return crypto.createHash('sha1').update(content,'utf-8').digest('hex');//creats an object capable of creating a sha1 for us 
    }

    async add(fileToBeAdded){
        const fileData =await fs.readFile(fileToBeAdded,{encoding:'utf-8'});
        const fileHash = this.hashObject(fileData);
        console.log(fileHash);
        const newFileHashedObjectPath =path.join(this.objectsPath,fileHash );
        await fs.writeFile(newFileHashedObjectPath,fileData);
        await this.updateStagingArea(fileToBeAdded,fileHash);
        
        console.log(`Added ${fileToBeAdded}`);
    }

    async updateStagingArea(filePath,fileHash){
      const index=JSON.parse(await fs.readFile(this.indexPath,{encoding:'utf-8'}));
      index.push({path:filePath,hash:fileHash});
      await fs.writeFile(this.indexPath,JSON.stringify(index));

    }
    async commit(commitMessage){
        const index=JSON.parse(await fs.readFile(this.indexPath,{encoding:'utf-8'}));
        const parentCommit = await this.getCurrentHead();

        const commitData={
            timeStamp: new Date().toISOString(),
            commitMessage,
            files: index,
            parent:parentCommit
        }
        const commitHash = this.hashObject(JSON.stringify(commitData));
        const commitPath = path.join(this.objectsPath,commitHash);
        await fs.writeFile(commitPath,JSON.stringify(commitData));
        await fs.writeFile(this.headPath,commitHash);
        await fs.writeFile(this.indexPath,JSON.stringify([]));
        console.log(`Committed ${commitMessage}`);
    }
    async getCurrentHead(){
        try{
            return await fs.readFile(this.headPath,{encoding:'utf-8'});
        }catch(error){
            return null;
        }
    }

    async log(){
        let currentCommit = await this.getCurrentHead();
        while(currentCommit){
            const commitData = JSON.parse(await fs.readFile(path.join(this.objectsPath,currentCommit),{encoding:'utf-8'}));

            console.log('_______________________________________________');
            
            console.log(`Commit:${currentCommit}\nDate: ${commitData.timeStamp}\nMessage: ${commitData.commitMessage}`);

            currentCommit=commitData.parent;
            
        }

    }

    async showCommitDiff(commitHash){ 
        const commitData = JSON.parse(await this.getCommitData(commitHash));
        if (!commitData){
            console.log('Commit not found');
            return;
        }
        console.log("Changes in the last commit are:");

        for(const file of commitData.files){
            console.log(`File: ${file.path}`);
            const fileContent = await this.getFileContent(file.hash);
            console.log(fileContent);

            if(commitData.parent){
                const parentCommitData = JSON.parse(await this.getCommitData(commitData.parent));
                const getParentFileContent= await this.getParentFileContent(parentCommitData,file.path);

                if(getParentFileContent !== undefined){
                    console.log('\nDiff:');
                    const diff = diffLines(getParentFileContent,fileContent);     

                    console.log(diff);

                    diff.forEach(part =>{
                        if(part.added){
                            process.stdout.write(chalk.green(part.value));
                        }else if(part.removed){
                            process.stdout.write(chalk.red(part.value));
                        }else{
                            process.stdout.write(chalk.gray(part.value));

                        }

                    });
                    console.log('\n');
                }else{
                    console.log('No changes in the file.New File commit');
                }
            }
            else{
                console.log('First commit. No parent to compare with.');
            }
        }
    }

    async getParentFileContent(parentCommitData,filePath){
        const parentfile = parentCommitData.files.find(file => file.path === filePath);
        if(parentfile){
            
            return await this.getFileContent(parentfile.hash);
        }
    }

    async getCommitData(commitHash){
        const commitPath=path.join(this.objectsPath,commitHash);
        try{
            return await fs.readFile(commitPath,{encoding:'utf-8'});
        }catch(error){
            console.log("failed to read the commit data",error);
            return null;
        }
    }

    async getFileContent(fileHash){
        const objectsPath = path.join(this.objectsPath,fileHash);
        return fs.readFile(objectsPath,{encoding:'utf-8'});
    }
}

// (async()=>{
    // const groot = new Groot();
    
//     await groot.add('1.txt');
//     await groot.add('2.txt');
    
//     await groot.commit('5th commit ');

//     await groot.log();
//     //await groot.showCommitDiff("6bfff943cce6158d827a9054d4adadf12559b05b");
// })();   

program.command('init').action(async ()=>{
    const groot = new Groot();

});

program.command('add <file>').action(async (file)=>{
    const groot = new Groot();
    await groot.add(file);
});

program.command('commit <message>').action(async(commitMessage)=>{
    const groot = new Groot();
    await groot.commit(commitMessage);
});

program.command('log').action(async()=>{
    const groot = new Groot();
    await groot.log();
});

program.command('show <commitHash>').action(async (commitHash)=>{
    const groot = new Groot();
    await groot.showCommitDiff(commitHash);
});

program.parse(process.argv);