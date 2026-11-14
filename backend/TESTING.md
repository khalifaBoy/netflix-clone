# Backend testing

Unit tests run with `npm test` and do not require MongoDB.

Integration tests run against a dedicated, ephemeral MongoDB container:

```sh
npm run test:integration
```

The runner starts `docker-compose.test.yml`, waits for its health check, runs
each integration suite sequentially with
`mongodb://127.0.0.1:27018/netflix_clone_test`, then removes the container and
its temporary data even when a suite fails. Docker Engine and Docker Compose
must be installed and available to the current user. The test MongoDB port is
bound to loopback only and has no persistent volume.

The test database helper rejects `mongodb+srv` and all non-loopback hosts. This
guard also applies when an integration test is launched directly instead of
through the runner. No test command falls back to `MONGO_URI`.

Run only the playback integration suite with `npm run test:playback`; it uses
the same ephemeral local MongoDB lifecycle.

To run the full backend suite:

```sh
npm run test:all
```
