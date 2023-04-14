## Load testing with K6

### To run

`brew install grafana/k6`
then
`k6 run index.js`

### Testing incoming FormSG Webhook

- Make a formsg submissions, and copy the ecrypted data and formsg signature from the logs
- Paste it in index.js and run the test

**Results**

- On average, with 10 vus running for 30s
- A single running ecs task (1vCPU) can handle about 4 requests per second with CPU under 50%

```
10vus for 30s
     checks.........................: 100.00% ✓ 1485     ✗ 0
     data_received..................: 105 kB  3.3 kB/s
     data_sent......................: 783 kB  25 kB/s
     http_req_blocked...............: avg=31.54ms  min=0s    med=1µs   max=591.91ms p(90)=2µs     p(95)=368.92ms
     http_req_connecting............: avg=810.96µs min=0s    med=0s    max=11.51ms  p(90)=0s      p(95)=10.96ms
     http_req_duration..............: avg=2.26s    min=1.59s med=2.26s max=2.96s    p(90)=2.63s   p(95)=2.78s
       { expected_response:true }...: avg=2.26s    min=1.59s med=2.26s max=2.96s    p(90)=2.63s   p(95)=2.78s
     http_req_failed................: 0.00%   ✓ 0        ✗ 135
     http_req_receiving.............: avg=385.2µs  min=12µs  med=149µs max=4.58ms   p(90)=880.4µs p(95)=1.42ms
     http_req_sending...............: avg=115.54µs min=20µs  med=74µs  max=2.01ms   p(90)=159.4µs p(95)=276.49µs
     http_req_tls_handshaking.......: avg=24.19ms  min=0s    med=0s    max=492.51ms p(90)=0s      p(95)=269.45ms
     http_req_waiting...............: avg=2.26s    min=1.58s med=2.26s max=2.96s    p(90)=2.63s   p(95)=2.78s
     http_reqs......................: 135     4.317078/s
     iteration_duration.............: avg=2.29s    min=1.59s med=2.27s max=3.37s    p(90)=2.64s   p(95)=3s
     iterations.....................: 135     4.317078/s
     vus............................: 5       min=5      max=10
     vus_max........................: 10      min=10     max=10

20vus for 30s
     checks.........................: 100.00% ✓ 1342     ✗ 0
     data_received..................: 153 kB  5.0 kB/s
     data_sent......................: 716 kB  23 kB/s
     http_req_blocked...............: avg=16.44ms  min=0s       med=0s    max=109.92ms p(90)=97.56ms p(95)=104.45ms
     http_req_connecting............: avg=1.76ms   min=0s       med=0s    max=11.65ms  p(90)=10.58ms p(95)=11.32ms
     http_req_duration..............: avg=4.92s    min=281.89ms med=4.85s max=5.97s    p(90)=5.96s   p(95)=5.96s
       { expected_response:true }...: avg=4.92s    min=281.89ms med=4.85s max=5.97s    p(90)=5.96s   p(95)=5.96s
     http_req_failed................: 0.00%   ✓ 0        ✗ 122
     http_req_receiving.............: avg=325.63µs min=8µs      med=73µs  max=9.67ms   p(90)=231.9µs p(95)=335.49µs
     http_req_sending...............: avg=55.21µs  min=18µs     med=42µs  max=748µs    p(90)=78.89µs p(95)=109.34µs
     http_req_tls_handshaking.......: avg=6.02ms   min=0s       med=0s    max=47.18ms  p(90)=34.02ms p(95)=40.6ms
     http_req_waiting...............: avg=4.92s    min=281.61ms med=4.85s max=5.97s    p(90)=5.96s   p(95)=5.96s
     http_reqs......................: 122     3.982004/s
     iteration_duration.............: avg=4.94s    min=282.89ms med=4.85s max=6.06s    p(90)=6.06s   p(95)=6.06s
     iterations.....................: 122     3.982004/s
     vus............................: 20      min=20     max=20
     vus_max........................: 20      min=20     max=20
```

### Testing worker job completion rate

- Test pipe: 1 incoming webhook to 1 outgoing webhook to https://mock.codes/200
- A single running ecs task (1vCPU) can handle about
