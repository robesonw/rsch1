---
applyTo: "backend/src/test/**/*.java"
---

# ArchUnit Layer Enforcement Tests

## Why this exists

Layer rules documented in `architecture.md` are only valuable if they're enforced automatically. ArchUnit tests run in CI and fail the build if any layer rule is violated. Copilot must never delete or weaken these tests.

## Required Tests — in `ArchitectureRulesTest.java`

```java
package com.paralleliq;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.*;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

class ArchitectureRulesTest {

    private final JavaClasses classes = new ClassFileImporter()
        .importPackages("com.paralleliq");

    @Test
    void layersShouldBeRespected() {
        layeredArchitecture().consideringAllDependencies()
            .layer("API").definedBy("com.paralleliq.api..")
            .layer("Application").definedBy("com.paralleliq.application..")
            .layer("Domain").definedBy("com.paralleliq.domain..")
            .layer("Infrastructure").definedBy("com.paralleliq.infrastructure..")
            .whereLayer("API").mayNotBeAccessedByAnyLayer()
            .whereLayer("Application").mayOnlyBeAccessedByLayers("API")
            .whereLayer("Domain").mayOnlyBeAccessedByLayers("Application", "Infrastructure")
            .whereLayer("Infrastructure").mayNotBeAccessedByAnyLayer()
            .check(classes);
    }

    @Test
    void domainModelsMustNotDependOnSpring() {
        noClasses()
            .that().resideInAPackage("com.paralleliq.domain..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("org.springframework..", "jakarta.persistence..")
            .as("Domain layer must be pure Java — no Spring or JPA imports")
            .check(classes);
    }

    @Test
    void domainModelsMustNotDependOnInfrastructure() {
        noClasses()
            .that().resideInAPackage("com.paralleliq.domain..")
            .should().dependOnClassesThat()
            .resideInAPackage("com.paralleliq.infrastructure..")
            .as("Domain must not depend on Infrastructure — use port interfaces")
            .check(classes);
    }

    @Test
    void controllersMustNotCallRepositoriesDirectly() {
        noClasses()
            .that().resideInAPackage("com.paralleliq.api..")
            .should().dependOnClassesThat()
            .resideInAPackage("com.paralleliq.infrastructure.persistence..")
            .as("Controllers must not call repositories — go through Application services")
            .check(classes);
    }

    @Test
    void connectorsMustImplementConnectorPort() {
        classes()
            .that().resideInAPackage("com.paralleliq.infrastructure.connector..")
            .and().haveSimpleNameEndingWith("Connector")
            .should().implement("com.paralleliq.domain.port.ConnectorPort")
            .as("All connector classes must implement ConnectorPort")
            .check(classes);
    }

    @Test
    void repositoriesMustNotBeUsedOutsideInfrastructure() {
        noClasses()
            .that().resideOutsideOfPackage("com.paralleliq.infrastructure..")
            .should().dependOnClassesThat()
            .resideInAPackage("com.paralleliq.infrastructure.persistence.repository..")
            .as("Spring repositories must not be injected above Infrastructure layer")
            .check(classes);
    }

    @Test
    void servicesMustNotDependOnDTOs() {
        noClasses()
            .that().resideInAPackage("com.paralleliq.domain..")
            .should().dependOnClassesThat()
            .resideInAPackage("com.paralleliq.api.dto..")
            .as("Domain services must not depend on API DTOs")
            .check(classes);
    }
}
```

Add ArchUnit to `pom.xml`:
```xml
<dependency>
    <groupId>com.tngtech.archunit</groupId>
    <artifactId>archunit-junit5</artifactId>
    <version>1.3.0</version>
    <scope>test</scope>
</dependency>
```

## Rule: Copilot must not delete or comment out any test in ArchitectureRulesTest

If a new feature genuinely requires a layer exception, it must be discussed and the rule updated with a documented justification — not silently bypassed.
