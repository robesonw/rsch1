---
applyTo: "paralleliq-api/src/test/**/*.java,paralleliq-agent/src/test/**/*.java,paralleliq-common/src/test/**/*.java"
---

# Testing Instructions — Java 8 + Spring Boot 2.7

## Java 8 test style

Spring Boot 2.7 supports both JUnit 4 and JUnit 5. Use JUnit 5 (Jupiter) throughout:

```java
// Spring Boot test (JUnit 5 — no @RunWith needed with Spring Boot 2.7)
@SpringBootTest
class ParallelServiceIT { ... }

// Unit test (JUnit 5 + Mockito)
@ExtendWith(MockitoExtension.class)
class ParallelServiceTest { ... }
```

Use AssertJ (`assertThat`) — never JUnit `assertEquals`.

## Test types per module

| Module | Type | Annotation | When |
|--------|------|-----------|------|
| common | Unit | `@ExtendWith(MockitoExtension.class)` | All domain service methods |
| api | Unit | `@ExtendWith(MockitoExtension.class)` | Application service methods |
| api | Controller | `@WebMvcTest` + `@MockBean` | Each REST endpoint |
| api | Repository | `@DataJpaTest` + Testcontainers | Each repository query |
| api | Integration | `@SpringBootTest` | Cross-layer flows |
| agent | Unit | `@ExtendWith(MockitoExtension.class)` | RunExecutor, transform, assert |
| agent | Connector | `@SpringBootTest` + real broker | Each connector |

## Domain / application service unit test pattern

```java
@ExtendWith(MockitoExtension.class)
class ParallelServiceTest {

    @Mock
    private ParallelRepository parallelRepository;

    @Mock
    private AuditService auditService;

    @InjectMocks
    private ParallelService parallelService;

    @Test
    public void shouldCloneParallelWithCopySuffix() {
        // Given
        ProductionParallelEntity original = ParallelFixtures.aParallel();
        given(parallelRepository.findById(original.getId()))
            .willReturn(Optional.of(original));
        given(parallelRepository.save(any())).willAnswer(i -> i.getArgument(0));

        // When
        ParallelDto cloned = parallelService.clone(original.getId(), "user1");

        // Then
        assertThat(cloned.getName()).isEqualTo(original.getName() + " (copy)");
        verify(auditService).record(argThat(e ->
            e.getAction() == AuditAction.CLONED));
    }
}
```

## Controller test pattern (paralleliq-api)

```java
@WebMvcTest(ParallelController.class)
class ParallelControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ParallelService parallelService;

    @MockBean
    private ParallelMapper parallelMapper;

    @Test
    @WithMockUser(roles = "TESTER")
    public void shouldReturn404WhenParallelNotFound() throws Exception {
        given(parallelService.findById(any()))
            .willThrow(new ParallelNotFoundException("not-found-id"));

        mockMvc.perform(get("/api/v1/parallels/{id}", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }
}
```

## Testcontainers SQL Server — for repository tests

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class RunRepositoryTest {

    @Container
    static MSSQLServerContainer<?> sqlServer =
        new MSSQLServerContainer<>("mcr.microsoft.com/mssql/server:2022-latest")
            .acceptLicense();

    @DynamicPropertySource
    static void sqlServerProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",      sqlServer::getJdbcUrl);
        registry.add("spring.datasource.username", sqlServer::getUsername);
        registry.add("spring.datasource.password", sqlServer::getPassword);
    }

    @Autowired
    private RunRepository runRepository;

    @Test
    public void shouldFindQueuedRunsOrderedByCreatedAt() {
        // ... test repository query
    }
}
```

Add to `paralleliq-api/build.gradle`:
```groovy
testImplementation 'org.testcontainers:mssqlserver:1.19.8'
testImplementation 'org.testcontainers:junit-jupiter:1.19.8'
```

## Agent unit test pattern

```java
@ExtendWith(MockitoExtension.class)
class KafkaConnectorTest {

    @Mock
    private KafkaConsumer<String, byte[]> mockConsumer;

    private KafkaConnector connector;

    @Before
    public void setUp() {
        connector = new KafkaConnector(kafkaProperties, meterRegistry);
    }

    @Test
    public void shouldWrapKafkaExceptionAsConnectorException() {
        given(mockConsumer.poll(any())).willThrow(new KafkaException("broker down"));

        assertThatThrownBy(() -> connector.capture("topic", options, connProps))
            .isInstanceOf(ConnectorException.class)
            .hasMessageContaining("broker down");
    }
}
```

## Test fixtures — create TestFixtures classes

```java
// paralleliq-api/src/test/java/com/paralleliq/api/fixtures/ParallelFixtures.java
public class ParallelFixtures {

    public static ProductionParallelEntity aParallel() {
        ProductionParallelEntity e = new ProductionParallelEntity();
        e.setId(UUID.randomUUID());
        e.setName("Test Parallel");
        e.setExecutionMode(ExecutionMode.REPLAY_VALIDATE);
        e.setCreatedBy("test-user");
        return e;
    }

    public static RunEntity aRun(UUID parallelId) {
        RunEntity r = new RunEntity();
        r.setId(UUID.randomUUID());
        r.setParallelId(parallelId);
        r.setStatus(RunStatus.QUEUED);
        r.setTriggeredBy("test-user");
        return r;
    }
}
```

## Naming conventions

- Unit test class: `{ClassName}Test`
- Integration test class: `{ClassName}IT`
- Test methods: `should{ExpectedBehaviour}` or `should{ExpectedBehaviour}When{Condition}`
- Use `@DisplayName` for complex test descriptions
