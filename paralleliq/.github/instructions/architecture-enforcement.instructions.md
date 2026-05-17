---
applyTo: "paralleliq-api/src/test/**/*.java"
---

# Architecture Enforcement — ArchUnit Tests

## Why this exists

Layer rules documented in `copilot-instructions.md` are only valuable if enforced automatically.
ArchUnit runs in CI and fails the build if any layer rule is violated.
**Copilot must never delete or weaken these tests.**

## Add ArchUnit to paralleliq-api/build.gradle

```groovy
testImplementation 'com.tngtech.archunit:archunit-junit5:1.3.0'
```

## Required test class

Create at:
`paralleliq-api/src/test/java/com/paralleliq/api/ArchitectureRulesTest.java`

```java
package com.paralleliq.api;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.*;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

/**
 * ArchUnit tests — enforce the layered architecture.
 * These tests run in CI. Do not delete or weaken them.
 * If a new feature genuinely requires a layer exception,
 * document the justification here and add an .ignoreDependency() call.
 */
class ArchitectureRulesTest {

    private final JavaClasses classes = new ClassFileImporter()
        .importPackages("com.paralleliq");

    @Test
    void layersShouldBeRespected() {
        layeredArchitecture().consideringAllDependencies()
            .layer("API").definedBy("com.paralleliq.api..")
            .layer("Application").definedBy("com.paralleliq.api.application..")
            .layer("Domain").definedBy("com.paralleliq.api.domain..")
            .layer("Infrastructure").definedBy("com.paralleliq.api.infrastructure..")
            .whereLayer("API").mayNotBeAccessedByAnyLayer()
            .whereLayer("Application").mayOnlyBeAccessedByLayers("API")
            .whereLayer("Domain").mayOnlyBeAccessedByLayers("Application", "Infrastructure")
            .whereLayer("Infrastructure").mayNotBeAccessedByAnyLayer()
            .check(classes);
    }

    @Test
    void domainMustNotDependOnSpring() {
        noClasses()
            .that().resideInAPackage("com.paralleliq.api.domain..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("org.springframework..", "javax.persistence..")
            .as("Domain layer must be pure Java — no Spring or JPA imports")
            .check(classes);
    }

    @Test
    void domainMustNotDependOnInfrastructure() {
        noClasses()
            .that().resideInAPackage("com.paralleliq.api.domain..")
            .should().dependOnClassesThat()
            .resideInAPackage("com.paralleliq.api.infrastructure..")
            .as("Domain must depend on port interfaces only — not implementations")
            .check(classes);
    }

    @Test
    void controllersMustNotCallRepositoriesDirectly() {
        noClasses()
            .that().resideInAPackage("com.paralleliq.api.controller..")
            .should().dependOnClassesThat()
            .resideInAPackage("com.paralleliq.api.infrastructure.persistence..")
            .as("Controllers must not access repositories — go through Application services")
            .check(classes);
    }

    @Test
    void servicesMustNotDependOnDtos() {
        noClasses()
            .that().resideInAPackage("com.paralleliq.api.domain..")
            .should().dependOnClassesThat()
            .resideInAPackage("com.paralleliq.api.dto..")
            .as("Domain services must not depend on API DTOs")
            .check(classes);
    }

    @Test
    void apiMustNotImportAgentCode() {
        noClasses()
            .that().resideInAPackage("com.paralleliq.api..")
            .should().dependOnClassesThat()
            .resideInAPackage("com.paralleliq.agent..")
            .as("paralleliq-api must not import paralleliq-agent classes — " +
                "agent is a separate deployable")
            .check(classes);
    }
}
```

## Rule: never bypass these tests

If a new feature requires a genuine exception to a layer rule:
1. Add `.ignoreDependency(SourceClass.class, TargetClass.class)` with a comment explaining why
2. Never comment out or delete a test to make a build pass
3. If unsure, raise the question before writing the code
