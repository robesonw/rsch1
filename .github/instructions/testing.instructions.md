---
applyTo: "backend/src/test/**/*.java"
---

# Testing Instructions

## Test Types and When to Write Each

| Test type | Annotation | When |
|-----------|-----------|------|
| Domain unit test | `@ExtendWith(MockitoExtension.class)` | Every domain service method |
| Application service test | `@ExtendWith(MockitoExtension.class)` | Every application service method, mock all ports |
| Connector integration test | `@SpringBootTest` + real broker (or Testcontainers) | Each connector's capture + replay |
| API integration test | `@SpringBootTest` + `@AutoConfigureMockMvc` | Each controller endpoint |
| DB integration test | `@DataJpaTest` + Testcontainers SQL Server | Each repository |

## Domain Service Test Pattern

```java
@ExtendWith(MockitoExtension.class)
class TransformServiceTest {

    @Mock
    private LookupPort lookupPort;

    @InjectMocks
    private TransformService transformService;

    @Test
    void shouldMapFieldUsingLookup() {
        // Given
        var rule = RuleSet.builder()
            .addMapping(FieldMapping.lookup("productCode", "product_desc", "products"))
            .build();
        given(lookupPort.lookup("products", "PC001")).willReturn(Optional.of("Home Buildings Plus"));

        // When
        var result = transformService.apply(sampleMessage(), rule);

        // Then
        assertThat(result.field("product_desc")).isEqualTo("Home Buildings Plus");
    }

    @Test
    void shouldThrowWhenLookupKeyNotFound() {
        given(lookupPort.lookup(any(), any())).willReturn(Optional.empty());

        assertThatThrownBy(() -> transformService.apply(sampleMessage(), ruleWithLookup()))
            .isInstanceOf(TransformException.class)
            .hasMessageContaining("Lookup key not found");
    }
}
```

## API Test Pattern

```java
@SpringBootTest
@AutoConfigureMockMvc
class ParallelControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean ParallelService parallelService;

    @Test
    void shouldReturnParallelById() throws Exception {
        given(parallelService.findById(any())).willReturn(aParallel());

        mockMvc.perform(get("/api/v1/parallels/{id}", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.name").value("Policy Renewal Q3"));
    }
}
```

## Testcontainers SQL Server Setup

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
@Testcontainers
class RunRepositoryTest {

    @Container
    static MSSQLServerContainer<?> sqlServer = new MSSQLServerContainer<>("mcr.microsoft.com/mssql/server:2022-latest")
        .acceptLicense();

    @DynamicPropertySource
    static void sqlServerProps(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", sqlServer::getJdbcUrl);
        r.add("spring.datasource.username", sqlServer::getUsername);
        r.add("spring.datasource.password", sqlServer::getPassword);
    }
}
```

## Assertion Conventions

- Use AssertJ (`assertThat`) — never JUnit `assertEquals`
- For domain objects: implement `equals`/`hashCode` or use AssertJ field-by-field comparison with `usingRecursiveComparison()`
- Name test methods: `should{ExpectedBehaviour}When{Condition}` or `should{ExpectedBehaviour}` for happy paths

## Test Data Builders

Create a `TestFixtures` class per domain aggregate in `src/test/java/com/paralleliq/fixtures/`:

```java
public class ParallelFixtures {
    public static ProductionParallel aParallel() {
        return ProductionParallel.builder()
            .id(UUID.randomUUID())
            .name("Test Parallel")
            .sourceBinding(aSourceBinding())
            .build();
    }

    public static SourceBinding aSourceBinding() {
        return SourceBinding.builder()
            .protocol(Protocol.IBM_MQ)
            .endpoint("TEST.QUEUE")
            .build();
    }
}
```
