import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, Alert } from "react-native";
import MapView, { Marker, Region, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import * as Location from "expo-location";

const MapScreen = () => {
  const { currentTheme } = useTheme();
  const [region, setRegion] = useState<Region>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "Location permission is required to show your position on the map."
        );
        return;
      }
      getCurrentLocation();
    } catch (error) {
      console.warn("Error requesting location permission:", error);
      Alert.alert("Error", "Failed to request location permission");
    }
  };

  const getCurrentLocation = async () => {
    try {
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      setUserLocation({ latitude, longitude });
    } catch (error) {
      console.log("Error getting location:", error);
      Alert.alert("Error", "Unable to get your location");
    }
  };

  const onRegionChange = (newRegion: Region) => {
    setRegion(newRegion);
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.background },
      ]}
    >
      <View style={styles.headerContainer}>
        <Text style={[styles.header, { color: currentTheme.colors.text }]}>
          Map
        </Text>
      </View>
      <View style={styles.viewPort}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          region={region}
          onRegionChangeComplete={onRegionChange}
          showsUserLocation={true}
          showsMyLocationButton={true}
          followsUserLocation={false}
          showsCompass={true}
          showsScale={true}
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          rotateEnabled={true}
          mapType="standard"
        >
          {userLocation && (
            <Marker
              coordinate={userLocation}
              title="You are here"
              description="Your current location"
              pinColor="red"
            />
          )}
        </MapView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center",
    zIndex: 1,
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    fontFamily: "Inder",
    textAlign: "center",
  },
  viewPort: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});

export default MapScreen;
