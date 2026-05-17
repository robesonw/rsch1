package com.paralleliq;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ParallelIQApplication {
    public static void main(String[] args) {
        SpringApplication.run(ParallelIQApplication.class, args);
    }
}
