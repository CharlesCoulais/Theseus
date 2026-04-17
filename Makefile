demo: kill
	@python3 -m http.server $(PORT) --directory . & open http://localhost:4242/demo/demo.html

kill:
	@lsof -nti:$(PORT) | xargs -r kill

port:
	@echo port=$(PORT)


PORT := 4242
RECIPE := $(firstword $(MAKECMDGOALS))
ifeq ($(RECIPE), $(filter $(RECIPE), port demo kill))
COUNT := $(words $(MAKECMDGOALS))
ifeq ($(COUNT), 2)
RUN_ARGS := $(wordlist 2, $(COUNT), $(MAKECMDGOALS))
$(eval $(RUN_ARGS):;@:)
PORT := $(RUN_ARGS)
endif
endif