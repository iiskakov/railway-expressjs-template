import express from 'express';
import simpleGit from 'simple-git';
import { Project } from 'ts-morph';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';


const app = express();
app.use(express.json());

app.post('/analyze', async (req, res) => {
    const repoUrl = req.body.repoUrl;
    if (!repoUrl) {
        return res.status(400).send({ error: 'repoUrl is required' });
    }

    // Clone repo into a temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-'));
    const git = simpleGit(tempDir);

    try {
        await git.clone(repoUrl, tempDir);
        // Initialize the project from the tsconfig.json
        const project = new Project({
            tsConfigFilePath: `${tempDir}/tsconfig.json`,
        });

        const analysisResult = analyzeProject(project);

        // Clean up the temporary directory
        await fs.remove(tempDir);

        res.json(analysisResult);
    } catch (error) {
        // Clean up and handle errors
        await fs.remove(tempDir);
        res.status(500).send({ error: error.message });
    }
});

const server = app.listen(3000, () => {
    console.log(`Server listening on port 3000`);
});

function analyzeProject(project) {
    const analysisResult = { files: [] };
    const sourceFiles = project.getSourceFiles().filter((sf) => !sf.getFilePath().includes('node_modules'));

    sourceFiles.forEach((sourceFile) => {
        const fileAnalysis = {
            filePath: sourceFile.getFilePath(),
            functions: [],
            arrowFunctions: [],
            reactComponents: [],
            classes: [],
            interfaces: [],
            enums: [],
            typeAliases: [],
        };

        // Functions
        sourceFile.getFunctions().forEach((func) => {
            fileAnalysis.functions.push({ name: func.getName(), code: func.getText() });
        });

        // Arrow Functions
        sourceFile.getVariableDeclarations().forEach((v) => {
            const initializer = v.getInitializer();
            if (initializer && initializer.getKindName() === 'ArrowFunction') {
                fileAnalysis.arrowFunctions.push({ name: v.getName(), code: initializer.getText() });
            }
        });

        // React Components
        sourceFile.getVariableDeclarations().forEach((v) => {
            const initializer = v.getInitializer();
            if (initializer && (initializer.getKindName() === 'JsxElement' || initializer.getText().includes('React.'))) {
                fileAnalysis.reactComponents.push({ name: v.getName(), code: initializer.getText() });
            }
        });

        // Classes
        sourceFile.getClasses().forEach((cls) => {
            fileAnalysis.classes.push({ name: cls.getName(), code: cls.getText() });
        });

        // Interfaces
        sourceFile.getInterfaces().forEach((intf) => {
            fileAnalysis.interfaces.push({ name: intf.getName(), code: intf.getText() });
        });

        // Enums
        sourceFile.getEnums().forEach((enumm) => {
            fileAnalysis.enums.push({ name: enumm.getName(), code: enumm.getText() });
        });

        // Type Aliases
        sourceFile.getTypeAliases().forEach((typeAlias) => {
            fileAnalysis.typeAliases.push({ name: typeAlias.getName(), code: typeAlias.getText() });
        });

        // Other symbols can be added here in a similar manner.

        analysisResult.files.push(fileAnalysis);
    });

    return analysisResult;
}
