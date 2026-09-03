# Brewbook mobile — the everyday commands.
#
#   make phone      build a Release for the plugged-in iPhone and install it
#   make sim        build for the simulator, start Metro, launch the app
#   make metro      just the dev server (with a cleared cache; there is no watchman)
#   make check      typecheck + lib tests
#   make ios-project  regenerate ios/ after a change to app.json or a native dependency
#
# The phone build embeds the JS, so it runs without this Mac. It expires after seven days on a
# free Apple ID; run `make phone` again to renew. Set DEVICE if more than one iPhone is paired:
#   xcrun xctrace list devices

DEVICE ?= $(shell xcrun xctrace list devices 2>/dev/null | grep -i "iphone" | grep -v -i simulator | head -1 | sed -E 's/.*\(([0-9A-F-]+)\)$$/\1/')
SIM    ?= iPhone 17 Pro
BUNDLE  = app.brewbook.mobile
DD      = $(HOME)/Library/Developer/Xcode/DerivedData/Brewbook-cli

.PHONY: phone sim metro check ios-project doctor stop

phone: ios/Pods
	@test -n "$(DEVICE)" || (echo "no iPhone found — plug it in and unlock it"; exit 1)
	cd ios && xcodebuild -workspace Brewbook.xcworkspace -scheme Brewbook -configuration Release \
	  -destination 'id=$(DEVICE)' -allowProvisioningUpdates -derivedDataPath $(DD) build | grep -E "error:|warning: .*Brewbook/|BUILD" || true
	xcrun devicectl device install app --device $(DEVICE) $(DD)/Build/Products/Release-iphoneos/Brewbook.app
	xcrun devicectl device process launch --device $(DEVICE) $(BUNDLE)

sim: ios/Pods
	cd ios && xcodebuild -workspace Brewbook.xcworkspace -scheme Brewbook -configuration Debug -sdk iphonesimulator \
	  -destination 'platform=iOS Simulator,name=$(SIM)' -derivedDataPath $(DD) CODE_SIGNING_ALLOWED=NO build | grep -E "error:|BUILD" || true
	$(MAKE) metro
	xcrun simctl boot "$(SIM)" 2>/dev/null || true
	open -a Simulator
	xcrun simctl install booted $(DD)/Build/Products/Debug-iphonesimulator/Brewbook.app
	xcrun simctl launch booted $(BUNDLE)

metro:
	-pkill -f "expo start"
	(CI=1 nohup npx expo start --dev-client --port 8081 --clear > .expo/metro.log 2>&1 &)
	@for i in $$(seq 1 30); do curl -s -o /dev/null http://localhost:8081/status && break; sleep 2; done; echo "metro up"

check:
	npm run typecheck
	npm test

ios-project:
	rm -rf ios
	npx expo prebuild --platform ios --no-install
	cd ios && pod install

ios/Pods:
	$(MAKE) ios-project

doctor:
	npx expo-doctor

stop:
	-pkill -f "expo start"
