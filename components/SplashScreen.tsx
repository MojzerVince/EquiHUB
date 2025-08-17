import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
  loading?: boolean;
  user?: any;
  onForceContinue?: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ 
  onFinish, 
  loading = false, 
  user = null, 
  onForceContinue 
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const loadingOpacity = useRef(new Animated.Value(0)).current;
  const [showForceButton, setShowForceButton] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    // Start the animation sequence
    const initialAnimation = Animated.sequence([
      // Fade in and scale up the logo
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // Hold for a moment
      Animated.delay(1200),
    ]);

    initialAnimation.start(() => {
      setAnimationComplete(true);
    });
  }, [fadeAnim, scaleAnim]);

  // Handle what happens after animation completes
  useEffect(() => {
    if (animationComplete) {
      if (loading && !user) {
        // Still loading and no user - show loading indicator
        Animated.timing(loadingOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        // Either not loading or user exists - finish splash
        Animated.timing(loadingOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }).start(() => {
            onFinish();
          });
        });
      }
    }
  }, [animationComplete, loading, user, loadingOpacity, fadeAnim, onFinish]);

  // Show force button after 3 seconds of loading (only for non-authenticated users)
  useEffect(() => {
    if (animationComplete && loading && !user) {
      const timer = setTimeout(() => {
        setShowForceButton(true);
      }, 3000);

      return () => {
        clearTimeout(timer);
        setShowForceButton(false);
      };
    } else {
      setShowForceButton(false);
    }
  }, [animationComplete, loading, user]);

  return (
    <LinearGradient
      colors={['#F60E5C', '#F99471', '#F60E5C']}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#F60E5C" />
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.logoIcon}>
          <Image
            source={require('../assets/icons/1024x 1024-02.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appName}>EquiHUB</Text>
        <Text style={styles.tagline}>Track Your Equestrian Journey</Text>
      </Animated.View>
      
      {/* Loading indicator and controls */}
      <Animated.View style={[styles.loadingContainer, { opacity: loadingOpacity }]}>
        <ActivityIndicator size="large" color="#FFFFFF" style={styles.loadingSpinner} />
        <Text style={styles.loadingText}>Loading EquiHUB...</Text>
        
        {showForceButton && onForceContinue && (
          <TouchableOpacity
            style={styles.forceButton}
            onPress={onForceContinue}
            activeOpacity={0.7}
          >
            <Text style={styles.forceButtonText}>Continue Anyway</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
      
      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <Text style={styles.footerText}>Powered by Innovation</Text>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inder',
    marginBottom: 8,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: 'Inder',
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Inder',
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 120,
    alignItems: 'center',
    width: '100%',
  },
  loadingSpinner: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: 'Inder',
    marginBottom: 20,
  },
  forceButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  forceButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inder',
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default SplashScreen;
