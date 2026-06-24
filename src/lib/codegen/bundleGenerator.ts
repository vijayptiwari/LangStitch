import type { GraphDocument, CanvasSnapshot, StitchNodeData } from '../../types/graph'
import type { Edge, Node } from '@xyflow/react'
import { slugify } from '../nodeRegistry'
import { generatePythonProject } from './pythonProjectGenerator'

function pkgName(doc: GraphDocument): string {
  return slugify(doc.name).replace(/_/g, '')
}

function className(doc: GraphDocument): string {
  const base = pkgName(doc)
  return base.charAt(0).toUpperCase() + base.slice(1)
}

export function generateSpringBootProject(
  doc: GraphDocument,
  pythonServiceUrl = 'http://langstitch-graph:8000',
): Record<string, string> {
  const name = doc.name || 'my_langgraph'
  const pkg = `com.langstitch.${pkgName(doc)}`
  const pkgPath = pkg.replace(/\./g, '/')
  const cls = className(doc)

  const pom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.4.1</version>
    <relativePath/>
  </parent>
  <groupId>${pkg}</groupId>
  <artifactId>${slugify(name)}</artifactId>
  <version>0.1.0</version>
  <name>${name}</name>
  <description>LangStitch Spring gateway for ${name}</description>
  <properties>
    <java.version>21</java.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
`

  const applicationYml = `server:
  port: 8080

langstitch:
  graph:
    name: ${name}
    python-service-url: ${pythonServiceUrl}

management:
  endpoints:
    web:
      exposure:
        include: health,info
`

  const mainApp = `package ${pkg};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ${cls}Application {
    public static void main(String[] args) {
        SpringApplication.run(${cls}Application.class, args);
    }
}
`

  const props = `package ${pkg};

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "langstitch.graph")
public record GraphProperties(String name, String pythonServiceUrl) {}
`

  const config = `package ${pkg};

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(GraphProperties.class)
public class AppConfig {

    @Bean
    RestClient graphRestClient(GraphProperties props) {
        return RestClient.builder()
                .baseUrl(props.pythonServiceUrl())
                .build();
    }
}
`

  const dto = `package ${pkg};

import java.util.Map;

public record InvokeRequest(Map<String, Object> input) {}
`

  const controller = `package ${pkg};

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/graph")
public class GraphController {

    private final RestClient graphClient;
    private final GraphProperties properties;

    public GraphController(RestClient graphClient, GraphProperties properties) {
        this.graphClient = graphClient;
        this.properties = properties;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "graph", properties.name());
    }

    @PostMapping("/invoke")
    public ResponseEntity<Map> invoke(@RequestBody InvokeRequest request) {
        Map body = graphClient.post()
                .uri("/invoke")
                .body(request.input())
                .retrieve()
                .body(Map.class);
        return ResponseEntity.ok(body);
    }
}
`

  const dockerfile = `FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
`

  return {
    'spring/pom.xml': pom,
    'spring/src/main/resources/application.yml': applicationYml,
    [`spring/src/main/java/${pkgPath}/${cls}Application.java`]: mainApp,
    [`spring/src/main/java/${pkgPath}/GraphProperties.java`]: props,
    [`spring/src/main/java/${pkgPath}/AppConfig.java`]: config,
    [`spring/src/main/java/${pkgPath}/InvokeRequest.java`]: dto,
    [`spring/src/main/java/${pkgPath}/GraphController.java`]: controller,
    'spring/Dockerfile': dockerfile,
  }
}

export function generatePythonRuntimeFiles(
  doc: GraphDocument,
  pythonCode: string,
): Record<string, string> {
  const name = slugify(doc.name || 'graph')
  return {
    [`python/${name}.py`]: pythonCode,
    'python/requirements.txt': `langgraph>=0.4.0\nlangchain-core>=0.3.0\nfastapi>=0.115.0\nuvicorn[standard]>=0.32.0\n`,
    'python/main.py': `"""LangStitch Python graph runtime."""
from fastapi import FastAPI
from pydantic import BaseModel
from ${name} import graph

app = FastAPI(title="${doc.name}")


class InvokeBody(BaseModel):
    input: dict


@app.get("/health")
def health():
    return {"status": "ok", "graph": "${doc.name}"}


@app.post("/invoke")
def invoke(body: InvokeBody):
    return graph.invoke(body.input)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`,
    'python/Dockerfile': `FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`,
  }
}

export function generateDockerCompose(doc: GraphDocument): string {
  const name = slugify(doc.name || 'graph')
  return `services:
  ${name}-python:
    build: ./python
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=\${OPENAI_API_KEY}

  ${name}-spring:
    build: ./spring
    ports:
      - "8080:8080"
    environment:
      - LANGSTITCH_GRAPH_PYTHON-SERVICE-URL=http://${name}-python:8000
    depends_on:
      - ${name}-python
`
}

export type ExportFormat = 'python' | 'spring' | 'full'

export function generateExportManifest(
  doc: GraphDocument,
  fileKeys: string[],
): string {
  const ev = doc.settings?.eval
  const hasEvalDataset =
    ev?.enabled && Boolean(ev.datasetName?.trim() || ev.datasetId?.trim())
  const pkg = slugify(doc.name) || 'langstitch_graph'
  const evalBundleFiles = hasEvalDataset
    ? ['langsmith.json', `src/${pkg}/eval_runner.py`].filter((f) => fileKeys.includes(f))
    : []

  return JSON.stringify(
    {
      version: '1.0',
      generated_at: new Date().toISOString(),
      project: doc.name,
      files: [...fileKeys].sort(),
      ...(hasEvalDataset
        ? {
            'eval-dataset': {
              enabled: true,
              dataset_name: ev?.datasetName ?? '',
              dataset_id: ev?.datasetId ?? '',
              bundle_files: evalBundleFiles,
            },
          }
        : {}),
    },
    null,
    2,
  )
}

export function buildExportBundle(
  doc: GraphDocument,
  projectJson: string,
  _pythonCode: string,
  format: ExportFormat,
  nodes: Node<StitchNodeData>[] = [],
  edges: Edge[] = [],
  canvasByGraph?: Record<string, CanvasSnapshot>,
): Record<string, string> {
  const files: Record<string, string> = {
    'langstitch.project.json': projectJson,
    '.gitignore': `.venv/\n__pycache__/\n*.pyc\n.env\n.idea/\ntarget/\ndist/\n*.egg-info/\n.pytest_cache/\n`,
    'README.md': `# ${doc.name}\n\nGenerated by [LangStitch](https://github.com/vijayptiwari/LangStitch).\n\n## Python 3.13 multi-module project\n\n\`\`\`bash\npython -m venv .venv && source .venv/bin/activate\npip install -e ".[dev]"\npytest\npython -m ${slugify(doc.name) || 'langstitch_graph'}\n\`\`\`\n\nImport \`langsmith.json\` in LangStitch IDE to restore metadata.\n`,
  }

  if (format === 'python' || format === 'full') {
    Object.assign(files, generatePythonProject(doc, projectJson, nodes, edges, canvasByGraph))
  }

  if (format === 'spring' || format === 'full') {
    Object.assign(files, generateSpringBootProject(doc))
  }

  if (format === 'full') {
    files['docker-compose.yml'] = generateDockerCompose(doc)
  }

  const fileKeys = Object.keys(files)
  fileKeys.push('export-manifest.json')
  files['export-manifest.json'] = generateExportManifest(doc, fileKeys)

  return files
}
