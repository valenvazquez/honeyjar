.PHONY: dev seed test build clean

dev:
	docker compose up --build

seed:
	docker compose run --rm backend npm run seed

test:
	cd backend && npm test

build:
	docker compose build

clean:
	docker compose down -v
