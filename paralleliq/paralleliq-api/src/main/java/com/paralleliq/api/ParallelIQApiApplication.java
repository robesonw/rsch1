package com.paralleliq.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * ParallelIQ API — deployed to PCF.
 *
 * Responsibilities:
 *   - Scenario and parallel configuration management
 *   - Run queue management (agents poll and post results here)
 *   - Results storage and reporting
 *   - Authentication (JWT or AD/LDAP)
 *   - React UI served as static assets
 *
 * NOT responsible for:
 *   - Connecting to IBM MQ, Kafka, Solace, SFTP (that is the agent's job)
 *   - Certificate management for messaging systems
 *   - Executing transform or assertion logic
 */
@SpringBootApplication
@EnableScheduling
public class ParallelIQApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(ParallelIQApiApplication.class, args);
    }
}
